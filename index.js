const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion } = require("mongodb");

// Load environment variables
dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// MongoDB connection
const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.62t6y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Initialize Database
async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");

    // MongoDB database and collection
    const db = client.db("edifica");
    const apartmentCollection = db.collection("apartments");

    // Routes

    // Health Check Route
    app.get("/", (req, res) => {
      res.send("Server is running...");
    });

    // Fetch apartments with filters (rent range and pagination)
    app.get("/api/apartments", async (req, res) => {
      const { minRent, maxRent, page = 1, limit = 6 } = req.query;

      try {
        // Construct query for filtering apartments by rent range
        const query = {
          rent: { $gte: parseInt(minRent), $lte: parseInt(maxRent) },
        };

        // Fetch apartments from MongoDB with pagination
        const apartmentsCursor = apartmentCollection.find(query);
        const apartments = await apartmentsCursor
          .skip((page - 1) * limit)
          .limit(parseInt(limit))
          .toArray();

        const total = await apartmentCollection.countDocuments(query);

        // Return the paginated apartments data
        res.json({
          apartments: apartments,
          total: total,
        });
      } catch (err) {
        console.error("Error fetching apartments:", err);
        res.status(500).json({ message: "Error fetching apartments." });
      }
    });

  } catch (error) {
    console.error("Error connecting to MongoDB", error);
  }
}

// Start Server
(async () => {
  try {
    await run(); // Correct function name here
    const PORT = process.env.PORT || 5000; 
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
