import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';

const app = new Hono();
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;

// CORS для iOS приложения
app.use('*', cors());

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'NaturalGlow API' });
});

// Helper: wait for prediction
async function waitForPrediction(predictionId) {
  const maxAttempts = 120;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` }
    });
    const data = await res.json();
    
    if (data.status === 'succeeded') {
      return data.output;
    } else if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(data.error || 'Prediction failed');
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Prediction timeout');
}

// Enhance endpoint - принимает base64 изображение
app.post('/enhance', async (c) => {
  try {
    const body = await c.req.json();
    const { image } = body;
    
    if (!image) {
      return c.json({ error: 'No image provided' }, 400);
    }

    console.log('Processing base64 image...');
    
    const imageUrl = image.startsWith('data:') 
      ? image 
      : `data:image/jpeg;base64,${image}`;

    // Flux QFACES - trained on high quality facial photos
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "4d1d2ea165dffc2d84792d350e9819e3eeb03dc6ceaffcd9c859bbc2d7301f7e",
        input: {
          image: imageUrl,
          model: "dev",
          prompt: "photo, high resolution, natural skin texture, visible pores, realistic, QFACES, photograph, detailed facial features, authentic",
          go_fast: false,
          lora_scale: 0.5,
          guidance_scale: 0,  // 0 = maximum identity preservation
          prompt_strength: 0.25,  // Low = subtle enhancement
          num_inference_steps: 50,
          output_format: "png",
          output_quality: 90,
        }
      })
    });
    
    const prediction = await res.json();
    console.log('Prediction response:', JSON.stringify(prediction, null, 2));
    
    if (prediction.error || !prediction.id) {
      throw new Error(prediction.error || `Failed to create prediction: ${JSON.stringify(prediction)}`);
    }
    
    console.log('Prediction created:', prediction.id);
    
    const output = await waitForPrediction(prediction.id);
    console.log('Enhancement complete:', output);
    
    // Flux returns array, get first
    const enhancedUrl = Array.isArray(output) ? output[0] : output;
    
    return c.json({ 
      success: true, 
      enhanced_url: enhancedUrl,
    });

  } catch (error) {
    console.error('Enhancement error:', error);
    return c.json({ 
      error: 'Enhancement failed', 
      details: error.message 
    }, 500);
  }
});

// Альтернативный endpoint - принимает URL изображения
app.post('/enhance-url', async (c) => {
  try {
    const body = await c.req.json();
    const { url } = body;
    
    if (!url) {
      return c.json({ error: 'No URL provided' }, 400);
    }

    console.log('Processing image from URL:', url);

    // Flux QFACES - trained on high quality facial photos
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "4d1d2ea165dffc2d84792d350e9819e3eeb03dc6ceaffcd9c859bbc2d7301f7e",
        input: {
          image: url,
          model: "dev",
          prompt: "photo, high resolution, natural skin texture, visible pores, realistic, QFACES, photograph, detailed facial features, authentic",
          go_fast: false,
          lora_scale: 0.5,
          guidance_scale: 0,  // 0 = maximum identity preservation
          prompt_strength: 0.25,  // Low = subtle enhancement
          num_inference_steps: 50,
          output_format: "png",
          output_quality: 90,
        }
      })
    });
    
    const prediction = await res.json();
    console.log('Prediction created:', prediction.id);
    
    if (prediction.error) {
      throw new Error(prediction.error);
    }
    
    const output = await waitForPrediction(prediction.id);
    console.log('Enhancement complete:', output);
    
    // Flux returns array, get first
    const enhancedUrl = Array.isArray(output) ? output[0] : output;
    
    return c.json({ 
      success: true, 
      enhanced_url: enhancedUrl,
    });

  } catch (error) {
    console.error('Enhancement error:', error);
    return c.json({ 
      error: 'Enhancement failed', 
      details: error.message 
    }, 500);
  }
});

const port = process.env.PORT || 3000;
console.log(`🚀 NaturalGlow API running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
