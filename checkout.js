const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  chicken: { 10: 1550, 20: 1500, 30: 1450 },
  seafood:  { 10: 1850, 20: 1800, 30: 1750 },
  steak:    { 10: 2100, 20: 2050, 30: 2000 },
};

const NAMES = {
  chicken: '🍗 Grilled Chicken Breast',
  seafood:  '🐟 Blackened Salmon + Tilapia',
  steak:    '🥩 USDA Ribeye Steak',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { items, delivery, cartSize } = req.body;
    // items: [{ protein: 'chicken', qty: 10 }, ...]

    const lineItems = items
      .filter(item => item.qty > 0)
      .map(item => {
        const tier = item.qty >= 30 ? 30 : item.qty >= 20 ? 20 : 10;
        const unitAmount = PRICES[item.protein][tier];
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: NAMES[item.protein],
              description: `${item.qty} meals · ${cartSize}-pack tier · $${(unitAmount / 100).toFixed(2)}/meal`,
            },
            unit_amount: unitAmount,
          },
          quantity: item.qty,
        };
      });

    if (delivery) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: '🚗 Delivery Fee', description: 'Atlanta metro flat delivery' },
          unit_amount: 1000,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${req.headers.origin || 'https://babyparka.vercel.app'}/?success=true`,
      cancel_url: `${req.headers.origin || 'https://babyparka.vercel.app'}/?cancelled=true`,
      metadata: {
        order_summary: items.map(i => `${i.protein} x${i.qty}`).join(', '),
        delivery: delivery ? 'yes' : 'no',
        cart_size: cartSize,
      },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
