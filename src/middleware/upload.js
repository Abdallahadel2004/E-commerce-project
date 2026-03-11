import multer from "multer";
import sharp from "sharp";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Configure multer for memory storage (to process with Sharp)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Process image with Sharp
export const processImage = async (buffer) => {
  try {
    const filename = `product_${uuidv4()}.webp`;
    
    // Process image: resize, convert to WebP, optimize
    const processedImage = await sharp(buffer)
      .resize({
        width: 800,
        height: 600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();

    return {
      filename,
      buffer: processedImage,
      mimetype: "image/webp",
    };
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
};

export default upload;