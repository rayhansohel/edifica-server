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
    console.log("Connected to MongoDB!");

    // MongoDB database and collections
    const userCollection = client.db("edifica").collection("users");
    const apartmentCollection = client.db("edifica").collection("apartments");
    const agreementCollection = client.db("edifica").collection("agreements");
    const announcementCollection = client
      .db("edifica")
      .collection("announcements");
    const couponCollection = client.db("edifica").collection("coupons");

    // JWT-related API
    // Send JWT Token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // Middleware to verify JWT token
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // Middleware to verify admin role
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await userCollection.findOne({ email });
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    //User Related API
    // Store new user in the database
    app.post("/users", async (req, res) => {
      const user = req.body;
      const existingUser = await userCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // Make User an admin
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const user = await userCollection.findOne({ email });
      res.send({ admin: user?.role === "admin" });
    });

    // Fetch all users
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.json(users);
    });

    // Delete a user
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await userCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Change user role
    app.patch("/users/role/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      if (!role) {
        return res.status(400).json({ message: "Role is required" });
      }
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );
      res.json({ message: "User role updated successfully" });
    });

    //Apartments Related API
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

    //Agreement Related API
    // Create an agreement (one per user)
    app.post("/agreement", async (req, res) => {
      const { userEmail } = req.body;
      const existingAgreement = await agreementCollection.findOne({
        userEmail,
      });
      if (existingAgreement) {
        return res
          .status(400)
          .json({ message: "You have already applied for an apartment" });
      }
      const result = await agreementCollection.insertOne(req.body);
      res.json(result);
    });

    // Fetch agreement details by user email for User Profile Dashboard
    app.get("/agreement/:email", async (req, res) => {
      const agreement = await agreementCollection.findOne({
        userEmail: req.params.email,
      });
      if (!agreement) {
        return res
          .status(404)
          .json({ message: "No agreement found for this user" });
      }
      res.json(agreement);
    });

    // Fetch all agreements for Admin
    app.get("/agreement", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const agreements = await agreementCollection.find().toArray();
        res.json(agreements);
      } catch (error) {
        res.status(500).json({ message: "Error fetching agreements", error });
      }
    });

    // Update agreement status by Admin
    app.patch("/agreement", verifyToken, verifyAdmin, async (req, res) => {
      const { email } = req.query;
      const updateFields = req.body;

      try {
        const result = await agreementCollection.updateOne(
          { userEmail: email },
          { $set: updateFields }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Agreement not found" });
        }
        res.json({ message: "Agreement updated successfully" });
      } catch (error) {
        res.status(500).json({ message: "Error updating agreement", error });
      }
    });

    // Change user role by Admin
    app.patch("/users/role", verifyToken, verifyAdmin, async (req, res) => {
      const { email } = req.query;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ message: "Role is required" });
      }

      try {
        const result = await userCollection.updateOne(
          { email },
          { $set: { role } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "User not found" });
        }
        res.json({ message: "User role updated successfully" });
      } catch (error) {
        res.status(500).json({ message: "Error updating user role", error });
      }
    });

    // Delete an agreement by user email
    app.delete("/agreement", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      try {
        const result = await agreementCollection.deleteOne({
          userEmail: email,
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Agreement not found" });
        }

        res.json({ message: "Agreement deleted successfully" });
      } catch (error) {
        res.status(500).json({ message: "Error deleting agreement", error });
      }
    });

    //Announcement Related API
    // Create a new announcement
    app.post("/announcements", verifyToken, verifyAdmin, async (req, res) => {
      const announcement = req.body;
      announcement.createdAt = new Date();
      const result = await announcementCollection.insertOne(announcement);
      res.send(result);
    });

    // Fetch all announcements
    app.get("/announcements", async (req, res) => {
      const announcements = await announcementCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.json(announcements);
    });

    // Delete an announcement by ID
    app.delete(
      "/announcements/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const result = await announcementCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.json(result);
      }
    );

    // Coupon Related API
    // Add New Coupon
    app.post("/coupons", verifyToken, verifyAdmin, async (req, res) => {
      const { code, discount, description } = req.body;
      if (!code || !discount || !description) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const coupon = { code, discount, description, available: true };
      const result = await couponCollection.insertOne(coupon);
      res.send(result);
    });

    //Fetch all Coupon
    app.get("/coupons", verifyToken, async (req, res) => {
      const coupons = await couponCollection.find().toArray();
      res.send(coupons);
    });
    
    //Update coupon Aviability status
    app.patch("/coupons/:id", verifyToken, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      const { available } = req.body;
      const result = await couponCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { available } }
      );
      res.send(result);
    });

    //Delete coupon
    app.delete("/coupons/:id", verifyToken, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      const result = await couponCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.post("/coupons/validate", verifyToken, async (req, res) => {
      const { code } = req.body;
      const coupon = await couponCollection.findOne({ code, available: true });
      if (!coupon) {
        return res
          .status(404)
          .json({ message: "Coupon not found or inactive" });
      }
      res.send(coupon);
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
