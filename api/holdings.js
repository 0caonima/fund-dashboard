const fs = require('fs');
const path = require('path');

const HOLDINGS_FILE = path.join('/tmp', 'holdings.json');

function getHoldings() {
  try {
    return JSON.parse(fs.readFileSync(HOLDINGS_FILE, 'utf8'));
  } catch {
    return { funds: [], settings: { refreshIntervalSeconds: 30 } };
  }
}

module.exports = (req, res) => {
  if (req.method === 'GET') {
    res.json(getHoldings());
  } else if (req.method === 'POST') {
    try {
      fs.writeFileSync(HOLDINGS_FILE, JSON.stringify(req.body, null, 2), 'utf8');
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
