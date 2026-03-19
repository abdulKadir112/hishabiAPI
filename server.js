const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Multer setup - memoryStorage use করো (disk না, কারণ Vercel-এ disk persistent নেই)
// file buffer-এ রাখবে, পরে Cloudinary বা Vercel Blob-এ upload করতে পারো
const storage = multer.memoryStorage();  // ★★★ Change here ★★★
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpg, .jpeg, .png, .webp allowed'), false);
    }
  },
});

// ★★★ Static /uploads serve remove করো বা conditional করো (Vercel-এ কাজ করবে না persistent ভাবে)
// app.use('/uploads', express.static('uploads'));  → comment out

// MongoDB - cached connection for serverless
const uri = process.env.MONGODB_URI || "mongodb+srv://ifter:ifter2026@ifter1.e6wwged.mongodb.net/ifterDB?retryWrites=true&w=majority";

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();
  console.log('MongoDB connected (cached)');
  cachedDb = client.db('ifterDB');
  return cachedDb;
}

// Routes
app.get('/', (req, res) => {
  res.send('Server is running 🚀 | Ifter Hisab API (Vercel mode)');
});

// POST /hishab - file upload example (memory-এ রাখা, URL save করো DB-এ)
app.post(
  '/hishab',
  upload.fields([
    { name: 'donorImage', maxCount: 1 },
    { name: 'receiverImage', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const db = await connectToDatabase();
      const body = req.body;
      const files = req.files || {};

      // ★★★ File handling: এখানে files.buffer আছে, Cloudinary-এ upload করো (নিচে example)
      // উদাহরণ: const donorImageUrl = await uploadToCloudinary(files.donorImage?.[0]?.buffer);
      // এখন dummy URL দিলাম (real-এ change করো)
      const donorImageUrl = files.donorImage?.[0] ? `https://example.com/uploads/${Date.now()}-donor.jpg` : null;
      const receiverImageUrl = files.receiverImage?.[0] ? `https://example.com/uploads/${Date.now()}-receiver.jpg` : null;

      const newTransaction = {
        type: body.type,
        amount: Number(body.amount),
        note: body.note?.trim() || body.description?.trim() || '',
        date: body.date || new Date().toISOString(),

        donorName: body.donorName?.trim() || '',
        donorPhone: body.donorPhone?.trim() || '',
        donorAddress: body.donorAddress?.trim() || '',
        donorImage: donorImageUrl,

        receiverName: body.receiverName?.trim() || '',
        receiverPhone: body.receiverPhone?.trim() || '',
        receiverAddress: body.receiverAddress?.trim() || '',
        receiverImage: receiverImageUrl,

        createdAt: new Date(),
      };

      const result = await db.collection('hishab').insertOne(newTransaction);

      res.status(201).json({ success: true, insertedId: result.insertedId.toString() });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

app.get('/hishab', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const transactions = await db.collection('hishab')
      .find({})
      .sort({ date: -1, createdAt: -1 })
      .toArray();

    let totalDonation = 0;
    let totalExpense = 0;

    const processedTransactions = transactions.map(t => {
      const safeAmount = Number(t.amount) || 0;

      if (t.type === 'donation') totalDonation += safeAmount;
      if (t.type === 'expense') totalExpense += safeAmount;

      return {
        ...t,
        _id: t._id.toString(),
        id: t._id.toString(),
        amount: safeAmount,
        note: t.note || t.description || '',
        donorImage: t.donorImage || null,
        receiverImage: t.receiverImage || null
      };
    });

    const netBalance = totalDonation - totalExpense;

    res.json({
      transactions: processedTransactions,
      totalDonation,
      totalExpense,
      netBalance
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/hishab/:id', async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { id } = req.params;
    const result = await db.collection('hishab').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ★★★ Vercel-এর জন্য export করো (app.listen remove)
module.exports = app;  // বা export default app; যদি ESM use করো