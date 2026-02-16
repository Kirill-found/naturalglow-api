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
  const maxAttempts = 60;
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

    // SDXL img2img with natural enhancement prompt
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
        input: {
          image: imageUrl,
          prompt: "professional portrait photo, DSLR quality, natural skin texture with visible pores, realistic skin tones, sharp details, natural lighting, no artificial smoothing, authentic human features",
          negative_prompt: "beauty filter, over-smoothed skin, poreless skin, airbrushed, plastic look, CGI, illustration, fake blur, artificial glow, AI artifacts, uncanny valley",
          prompt_strength: 0.35,  // Very low = minimal change
          num_inference_steps: 25,
          guidance_scale: 7,
        }
      })
    });
    
    const prediction = await res.json();
    console.log('Prediction created:', prediction.id);
    
    const output = await waitForPrediction(prediction.id);
    console.log('Enhancement complete:', output);
    
    return c.json({ 
      success: true, 
      enhanced_url: output,
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

    // SDXL img2img with natural enhancement prompt
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
        input: {
          image: url,
          prompt: "professional portrait photo, DSLR quality, natural skin texture with visible pores, realistic skin tones, sharp details, natural lighting, no artificial smoothing, authentic human features",
          negative_prompt: "beauty filter, over-smoothed skin, poreless skin, airbrushed, plastic look, CGI, illustration, fake blur, artificial glow, AI artifacts, uncanny valley",
          prompt_strength: 0.35,  // Very low = minimal change
          num_inference_steps: 25,
          guidance_scale: 7,
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
    
    return c.json({ 
      success: true, 
      enhanced_url: output,
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
