// Required modules
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const port = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// MongoDB connection
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const userCollection = client.db("edifica").collection("users");
    const apartmentCollection = client.db("edifica").collection("apartments");
    const agreementCollection = client.db("edifica").collection("agreements");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middleware verifyToken
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    //Middleware to verify admin after token verification
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    //Make User as an admin
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // Fetch all user
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.json(users);
    });

    // Delete User
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // change user role
    app.patch("/users/role/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      if (!role) {
        return res.status(400).json({ message: "Role is required" });
      }

      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: { role },
      };

      try {
        const result = await userCollection.updateOne(filter, updatedDoc);
        if (result.modifiedCount > 0) {
          res.json({ message: "User role updated successfully" });
        } else {
          res
            .status(404)
            .json({ message: "User not found or no changes made" });
        }
      } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ message: "Failed to update user role" });
      }
    });

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
      const existingAgreement = await agreementCollection.findOne({
        userEmail,
      });

      if (existingAgreement) {
        return res
          .status(400)
          .json({ message: "You have already applied for an apartment" });
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
        return res
          .status(404)
          .json({ message: "No agreement found for this user" });
      }

      res.json(agreement);
    });

    // Store user in the database
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
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
