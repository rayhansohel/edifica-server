// Required modules
const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

const port = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// MongoDB connection
const { MongoClient, ServerApiVersion } = require("mongodb");
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
    // await client.connect();
    console.log("Connected to MongoDB!");

    // MongoDB database and collections
    const apartmentCollection = client.db("edifica").collection("apartments");
    const agreementCollection = client.db("edifica").collection("agreements");
    const userCollection = client.db("edifica").collection("users");

    // Fetch all apartments
    app.get("/all-apartments", async (req, res) => {
      const apartments = await apartmentCollection.find().toArray();
      res.json(apartments);
    });

    // Fetch apartments with filters (rent range and pagination)
    app.get("/apartments", async (req, res) => {
      const { minRent, maxRent, page = 1, limit = 8 } = req.query;

      const query = {
        rent: { $gte: parseInt(minRent), $lte: parseInt(maxRent) },
      };

      const apartments = await apartmentCollection
        .find(query)
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .toArray();

      const total = await apartmentCollection.countDocuments(query);

      res.json({ apartments, total });
    });

    // Create an agreement (one per user)
    app.post("/agreement", async (req, res) => {
      const { userEmail } = req.body;

      // Check if the user has already applied for an apartment
      const existingAgreement = await agreementCollection.findOne({ userEmail });

      if (existingAgreement) {
        return res.status(400).json({ message: "You have already applied for an apartment" });
      }

      // Insert new agreement if no existing record found
      const result = await agreementCollection.insertOne(req.body);
      res.json(result);
    });

    // Fetch agreement details by user email
    app.get("/agreement/:email", async (req, res) => {
      const { email } = req.params;
      const agreement = await agreementCollection.findOne({ userEmail: email });

      if (!agreement) {
        return res.status(404).json({ message: "No agreement found for this user" });
      }

      res.json(agreement);
    });

  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

// Start Server
app.get("/", (req, res) => {
  res.send("Server is Running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
