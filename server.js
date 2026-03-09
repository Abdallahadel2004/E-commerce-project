import { app } from "./src/app.js";
import connectDB from "./src/config/db.js";

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(
      "Server is running on port 3000, click here: http://localhost:" + PORT,
    );
  });
};

startServer();
