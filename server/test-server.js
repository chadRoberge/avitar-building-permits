const express = require('express');
const cors = require('cors');

const app = express();

// Enable CORS
app.use(
  cors({
    origin: ['http://localhost:4200', 'http://localhost:4201'],
    credentials: true,
  }),
);

app.use(express.json());

// Simple test routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Test server running' });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route works!' });
});

app.get('/api/permit-types', (req, res) => {
  res.json({ message: 'Permit types route works!', data: [] });
});

// 404 handler
app.use((req, res) => {
  console.log(`404 - ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Route not found' });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log('Available routes:');
  console.log('- GET /api/health');
  console.log('- GET /api/test');
  console.log('- GET /api/permit-types');
});
