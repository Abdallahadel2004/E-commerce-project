import mongoose from "mongoose";
import { faker } from "@faker-js/faker";
import Product from "../models/product.js";

const MONGO_URI =
  "mongodb+srv://omar_abdelsattar:qwe12345@ecommerce.ib6jz4o.mongodb.net/ecommerce?retryWrites=true&w=majority";

const creatorId = "60d5f9f8b8d4a82b1c3e9a1a"; // your user ID
const categories = [
  new mongoose.Types.ObjectId(),
  new mongoose.Types.ObjectId(),
  new mongoose.Types.ObjectId(),
];

async function seedProducts() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB Connected");

  const products = [];

  for (let i = 0; i < 10; i++) {
    const categoryId = faker.helpers.arrayElement(categories);

    const price = faker.number.int({ min: 20, max: 2000 });
    const compareAtPrice = faker.number.int({
      min: price + 10,
      max: price + 500,
    });

    products.push({
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      shortDescription: faker.commerce.productAdjective(),
      price: price,
      compareAtPrice: compareAtPrice,
      category: categoryId,
      createdBy: creatorId,
      sku: `SKU-${faker.string.alphanumeric(8).toUpperCase()}`,
      images: [
        {
          url: `https://picsum.photos/seed/product${i}/600/600`,
          publicId: `product_${i}`,
          alt: `Product image ${i}`,
          isPrimary: true,
        },
      ],
      inventory: {
        quantity: faker.number.int({ min: 1, max: 100 }),
        trackInventory: true,
        lowStockThreshold: faker.number.int({ min: 1, max: 10 }),
      },
      ratings: {
        average: faker.number.float({ min: 3, max: 5, precision: 0.1 }),
        count: faker.number.int({ min: 1, max: 1000 }),
      },
      isActive: true,
      isFeatured: faker.datatype.boolean(),
    });
  }

  await Product.insertMany(products);
  console.log("✅ 1000 products inserted successfully");

  mongoose.disconnect();
}

seedProducts();
