const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'babyparka2024';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, password, customerId, amount, paymentMethodId, note } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (action === 'get_dashboard') {
      // Fetch all payment intents (orders)
      const [paymentIntents, customers] = await Promise.all([
        stripe.paymentIntents.list({ limit: 100, expand: ['data.customer'] }),
        stripe.customers.list({ limit: 100, expand: ['data.sources'] }),
      ]);

      const orders = paymentIntents.data
        .filter(pi => pi.status === 'succeeded')
        .map(pi => ({
          id: pi.id,
          amount: pi.amount,
          created: pi.created,
          customer: pi.customer,
          customerName: pi.customer?.name || pi.metadata?.customer_name || 'Unknown',
          customerEmail: pi.customer?.email || pi.receipt_email || '',
          metadata: pi.metadata,
          deliveryType: pi.metadata?.delivery === 'yes' ? 'Delivery' : 'Pickup',
          orderSummary: pi.metadata?.order_summary || '',
          cartSize: pi.metadata?.cart_size || '',
        }));

      // Customers with saved payment methods
      const customerList = await Promise.all(
        customers.data.map(async (c) => {
          const paymentMethods = await stripe.paymentMethods.list({
            customer: c.id,
            type: 'card',
          });
          return {
            id: c.id,
            name: c.name || 'Unknown',
            email: c.email || '',
            phone: c.phone || '',
            created: c.created,
            savedCard: paymentMethods.data[0] ? {
              id: paymentMethods.data[0].id,
              brand: paymentMethods.data[0].card.brand,
              last4: paymentMethods.data[0].card.last4,
              expMonth: paymentMethods.data[0].card.exp_month,
              expYear: paymentMethods.data[0].card.exp_year,
            } : null,
            orders: orders.filter(o =>
              o.customer === c.id || o.customerEmail === c.email
            ),
          };
        })
      );

      return res.status(200).json({ orders, customers: customerList });
    }

    if (action === 'charge_customer') {
      if (!customerId || !amount || !paymentMethodId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const amountCents = Math.round(parseFloat(amount) * 100);
      if (amountCents < 50) return res.status(400).json({ error: 'Amount too small' });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        description: note || 'Meal prep order — @babyparka',
        metadata: { charged_from_admin: 'true', note: note || '' },
      });

      return res.status(200).json({
        success: true,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        status: paymentIntent.status,
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
