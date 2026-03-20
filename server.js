const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');

const app = express();

// ✅ CORS (Production ready)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
}));

// ✅ Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Multer
const upload = multer({ storage: multer.memoryStorage() });

// ✅ MongoDB
const uri = process.env.MONGODB_URI;
let cachedDb = null;

async function connectDB() {
  if (cachedDb) return cachedDb;

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();
  cachedDb = client.db('ifterDB');
  console.log("MongoDB Connected ✅");
  return cachedDb;
}

// ================= ROUTES =================

// Root
app.get('/', (req, res) => {
  res.send('API running 🚀');
});

// ✅ GET all
app.get('/hishab', async (req, res) => {
  try {
    const db = await connectDB();

    const data = await db.collection('hishab')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ POST
app.post('/hishab', upload.none(), async (req, res) => {
  try {
    const db = await connectDB();
    const body = req.body;

    const newTransaction = {
      type: body.type,
      amount: Number(body.amount) || 0,
      note: body.note || '',
      donorName: body.donorName || '',
      donorPhone: body.donorPhone || '',
      donorAddress: body.donorAddress || '',
      receiverName: body.receiverName || '',
      receiverPhone: body.receiverPhone || '',
      receiverAddress: body.receiverAddress || '',
      createdAt: new Date(),
    };

    const result = await db.collection('hishab').insertOne(newTransaction);

    res.json({
      success: true,
      id: result.insertedId
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ DELETE
app.delete('/hishab/:id', async (req, res) => {
  try {
    const db = await connectDB();

    await db.collection('hishab').deleteOne({
      _id: new ObjectId(req.params.id)
    });

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ UPDATE
app.put('/hishab/:id', upload.none(), async (req, res) => {
  try {
    const db = await connectDB();
    const body = req.body;

    const updated = {
      type: body.type,
      amount: Number(body.amount) || 0,
      note: body.note || '',
      donorName: body.donorName || '',
      receiverName: body.receiverName || '',
    };

    await db.collection('hishab').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updated }
    );

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= START =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running 🚀"));