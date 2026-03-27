require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
async function run() {
  const models = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-pro', 'gemini-1.0-pro', 'gemini-2.0-flash'];
  for (const modelName of models) {
    try {
      console.log('Testing', modelName);
      const model = genAI.getGenerativeModel({ model: modelName });
      const res = await model.generateContent('Translate to English: huy');
      console.log(modelName, 'SUCCESS:', res.response.text().trim());
      break;
    } catch (e) {
      console.error(modelName, 'FAILED:', e.message);
    }
  }
}
run();
