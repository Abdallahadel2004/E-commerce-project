import cloudinary from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class CloudinaryService {
  /**
   * Upload image to Cloudinary
   * @param {Buffer} buffer - Image buffer
   * @param {string} filename - Original filename
   * @returns {Promise<Object>} Cloudinary upload result
   */
  static async uploadImage(buffer, filename) {
    return new Promise((resolve, reject) => {
      cloudinary.v2.uploader
        .upload_stream(
          {
            resource_type: "image",
            folder: "ecommerce/products",
            public_id: filename.replace(/\.[^/.]+$/, ""), // Remove extension
            format: "webp",
            quality: "auto:good",
            width: 800,
            height: 600,
            crop: "limit",
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        )
        .end(buffer);
    });
  }

  /**
   * Delete image from Cloudinary
   * @param {string} publicId - Cloudinary public ID
   * @returns {Promise<Object>} Cloudinary delete result
   */
  static async deleteImage(publicId) {
    return new Promise((resolve, reject) => {
      cloudinary.v2.uploader.destroy(publicId, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Delete multiple images from Cloudinary
   * @param {string[]} publicIds - Array of Cloudinary public IDs
   * @returns {Promise<Object>} Cloudinary delete result
   */
  static async deleteImages(publicIds) {
    return new Promise((resolve, reject) => {
      cloudinary.v2.api.delete_resources(publicIds, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Get image URL with transformations
   * @param {string} publicId - Cloudinary public ID
   * @param {Object} options - Transformation options
   * @returns {string} Image URL
   */
  static getImageUrl(publicId, options = {}) {
    return cloudinary.v2.url(publicId, {
      width: options.width || 800,
      height: options.height || 600,
      crop: options.crop || "limit",
      quality: "auto:good",
      format: "webp",
      ...options,
    });
  }
}

export default CloudinaryService;