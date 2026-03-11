
import fs from 'fs';
import path from 'path';
import axios from 'axios';
const BASE_URL = 'http://localhost:3000';
const TEST_PRODUCT_ID = '69af74fdbd8c342c6d85193b'; 
const TEST_IMAGE_PATH = path.join(process.cwd(), 'test-image.jpg');

async function testImageUpload() {
  try {
    console.log(' Testing image upload functionality...\n');
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      console.log(' Test image not found. Please create a test-image.jpg file in the project root.');
      return;
    }
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    
    form.append('images', fs.createReadStream(TEST_IMAGE_PATH), {
      filename: 'test-image.jpg',
      contentType: 'image/jpeg'
    });

    console.log('📤 Uploading test image...');

    const response = await axios.post(
      `${BASE_URL}/api/products/${TEST_PRODUCT_ID}/upload`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': 'Bearer your-jwt-token-here' 
        },
        timeout: 30000
      }
    );

    console.log('✅ Image upload successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error(' Image upload failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the test
testImageUpload();