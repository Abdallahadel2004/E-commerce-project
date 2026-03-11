# Image Upload Guide

This guide explains how to use the image upload functionality for products in your e-commerce API.

## Overview

The image upload system supports:
- **File uploads** via `multipart/form-data` (recommended)
- **JSON body uploads** for existing URLs
- **Cloudinary integration** for image storage and optimization
- **Image processing** with Sharp (resize, WebP conversion, optimization)
- **Primary image management**

## API Endpoints

### 1. Upload Product Images (File Upload) - POST `/api/products/:id/upload`

Upload multiple images as files to a product.

**Request:**
```bash
curl -X POST "http://localhost:3000/api/products/PRODUCT_ID/upload" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg" \
  -F "alt=Product description"
```

**Features:**
- Accepts up to 5 images at once
- Automatically processes images (resize to 800x600, convert to WebP)
- First uploaded image becomes primary if no images exist
- Returns processed image URLs from Cloudinary

### 2. Add Images (JSON) - POST `/api/products/:id/images`

Add existing image URLs to a product.

**Request:**
```bash
curl -X POST "http://localhost:3000/api/products/PRODUCT_ID/images" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "images": [
      {
        "url": "https://example.com/image1.jpg",
        "publicId": "image1_public_id",
        "alt": "Product image 1",
        "isPrimary": true
      }
    ]
  }'
```

### 3. Delete Product Image - DELETE `/api/products/:id/images/:imageId`

Delete an image from a product and remove it from Cloudinary.

**Request:**
```bash
curl -X DELETE "http://localhost:3000/api/products/PRODUCT_ID/images/IMAGE_PUBLIC_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Set Primary Image - PUT `/api/products/:id/images/:imageId/primary`

Set an image as the primary image for a product.

**Request:**
```bash
curl -X PUT "http://localhost:3000/api/products/PRODUCT_ID/images/IMAGE_PUBLIC_ID/primary" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Image Processing

All uploaded images are automatically processed:

1. **Resize**: Maximum 800x600 pixels (maintains aspect ratio)
2. **Format**: Convert to WebP for better compression
3. **Quality**: Optimized at 80% quality
4. **Storage**: Uploaded to Cloudinary with automatic optimization

## Response Format

**Successful Upload Response:**
```json
{
  "success": true,
  "message": "2 image(s) uploaded successfully",
  "images": [
    {
      "url": "https://res.cloudinary.com/your-cloud/image/upload/v123/product_abc123.webp",
      "publicId": "product_abc123",
      "alt": "Product image 1",
      "isPrimary": true,
      "_id": "69af74fdbd8c342c6d85193b"
    }
  ]
}
```

## Frontend Integration Example

### Using FormData (Recommended)

```javascript
async function uploadProductImages(productId, files, altText = '') {
  const formData = new FormData();
  
  // Add images
  files.forEach(file => {
    formData.append('images', file);
  });
  
  // Add optional alt text
  if (altText) {
    formData.append('alt', altText);
  }

  const response = await fetch(`/api/products/${productId}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: formData
  });

  return await response.json();
}

// Usage
const files = document.getElementById('image-input').files;
const result = await uploadProductImages('PRODUCT_ID', files, 'Product description');
```

### Using Axios

```javascript
import axios from 'axios';

const uploadImages = async (productId, files) => {
  const formData = new FormData();
  
  files.forEach(file => {
    formData.append('images', file);
  });

  const response = await axios.post(
    `/api/products/${productId}/upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`
      }
    }
  );

  return response.data;
};
```

## Environment Setup

### Cloudinary Configuration

Add these environment variables to your `.env` file:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**To get Cloudinary credentials:**
1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Create a free account
3. Get your cloud name, API key, and API secret from the dashboard

## Error Handling

### Common Errors

- **400 Bad Request**: No images uploaded, invalid file type, or missing product
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: User doesn't have admin permissions
- **404 Not Found**: Product not found or image not found
- **500 Internal Server Error**: Server error during upload or processing

### Error Response Format

```json
{
  "success": false,
  "message": "Error description"
}
```

## Best Practices

1. **Image Size**: Keep original images under 5MB
2. **Image Format**: Upload JPEG, PNG, or WebP files
3. **Alt Text**: Always provide descriptive alt text for accessibility
4. **Primary Image**: Set the best quality image as primary
5. **Cleanup**: Delete unused images to save storage space

## Testing

Use the provided test script:

```bash
# Create a test image file
echo "Test image content" > test-image.jpg

# Run the test
node test-image-upload.js
```

## Security

- Only authenticated admin users can upload images
- File type validation prevents non-image uploads
- File size limits prevent large file uploads
- Cloudinary handles secure storage and CDN delivery