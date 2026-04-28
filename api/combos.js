const Anthropic = require('@anthropic-ai/sdk');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'babyparka2024';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });

  const now = new Date();
  const month = now.toLocaleString('default', { month: 'long' });
  const season = ['December','January','February'].includes(month) ? 'Winter'
    : ['March','April','May'].includes(month) ? 'Spring'
    : ['June','July','August'].includes(month) ? 'Summer' : 'Fall';

  const prompt = `You are a meal prep nutrition expert and business advisor for @babyparka, a premium Atlanta meal prep business. Current month: ${month} (${season}).

Their available proteins and ingredients:
- Grilled Chicken Breast (6oz = 165 cal, 43.5g protein, 0g carb, 0.8g fat) — $15.50/meal
- Blackened Atlantic Salmon (5.35oz = 300 cal, 29g protein, 1g carb, 20g fat)
- Farm Raised Tilapia (4oz = 110 cal, 21g protein, 0g carb, 3g fat)
- USDA Choice Ribeye (6oz = 350 cal, 28g protein, 0g carb, 28g fat) — $21/meal
- Garlic Mashed Potatoes (143g = 154 cal, 3g fat, 19.5g carb, 3.1g protein)
- Cilantro Lime Rice (143g = 240 cal, 6g fat, 41g carb, 4g protein)
- Black Beans (half cup = 130 cal, 0.5g fat, 23g carb, 8g protein)
- Fire Roasted Veggies (85g = 40 cal, 2g fat, 6g carb, 1g protein)
- Corn (half cup = 65 cal, 1g fat, 15g carb, 2g protein)
- Peppers and Onions

Generate exactly 6 creative meal combo suggestions optimized for HIGH PROTEIN and LOW CALORIES using ONLY the ingredients above. Include a mix of hot and cold meals. Make them seasonal and interesting. Consider suggesting a price increase or premium protein add-on option where it makes sense.

Return ONLY a valid JSON array with exactly this structure, no other text:
[{
  "name": "Combo Name",
  "description": "1-2 sentence description, why it works for the season and goals",
  "temp": "hot",
  "season": "${season} pick · reason why",
  "ingredients": ["ingredient 1 with portion", "ingredient 2 with portion"],
  "macros": { "calories": 000, "protein": "00g", "carbs": "00g", "fat": "00g" },
  "suggestedPrice": "$00.00",
  "priceNote": "vs base price — why this price",
  "proteinTip": "one line tip to boost protein further"
}]`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    const combos = JSON.parse(clean);
    res.status(200).json({ combos, season, month });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
