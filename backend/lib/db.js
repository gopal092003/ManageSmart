const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI); // no need for useNewUrlParser or useUnifiedTopology
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("Mongo connect error", err);
    process.exit(1);
  }
};

module.exports = connectDB;
