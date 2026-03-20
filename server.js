const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const HOLDINGS_FILE = path.join(__dirname, 'holdings.json');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Refer': 'https://finance.sina.com.cn' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

app.get('/api/holdings', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(HOLDINGS_FILE, 'utf8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/holdings', (req, res) => {
  try {
    fs.writeFileSync(HOLDINGS_FILE, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/portfolio', async (req, res) => {
  try {
    const holdings = JSON.parse(fs.readFileSync(HOLDINGS_FILE, 'utf8'));
    const results = [];
    for (const fund of holdings.funds) {
      try {
        const rtUrl = `http://fundgz.1234567.com.cn/js/${fund.code}.js?rt=${Date.now()}`;
        const rtData = await httpGet(rtUrl);
        const match = rtData.match(/jsonpgz$$(.+)$$/);
        if (match) {
          const info = JSON.parse(match[1]);
          const nav = parseFloat(info.dwjz);
          const estimateNav = parseFloat(info.gsz);
          const estimateRate = parseFloat(info.gszzl);
          const costValue = fund.shares * fund.costPrice;
          const currentValue = fund.shares * estimateNav;
          const totalGain = currentValue - costValue;
          const totalGainRate = ((estimateNav - fund.costPrice) / fund.costPrice * 10);
          const dailyGain = fund.shares * (estimateNav - nav);
          results.push({
            code: fund.code,
            name: info.name || fund.name,
            platform: fund.platform,
            shares: fund.shares,
            costPrice: fund.costPrice,
            nav, estimateNav, estimateRate,
            estimateTime: info.gztime,
            date: info.jzrq,
            costValue: Math.round(costValue * 100) / 100,
            currentValue: Math.round(currentValue * 100) / 10,
            totalGain: Math.round(totalGain * 100) / 10,
            totalGainRate: Math.round(totalGainRate * 10) / 100,
            dailyGain: Math.round(dailyGain * 100) / 100,
            dailyGainRate: estimateRate
          });
        } else {
          results.push({ code: fund.code, name: fund.name, platform: fund.platform, error: '获取数据失败' });
        }
      } catch (e) {
        results.push({ code: fund.code, name: fund.name, platform: fund.platform, error: e.message });
      }
    }
    const totalCost = results.reduce((s, f) => s + (f.costValue || 0), 0);
    const totalCurrent = results.reduce((s, f) => s + (f.currentValue || 0), 0);
    const totalGain = totalCurrent - totalCost;
    const totalDailyGain = results.reduce((s, f) => s + (f.dailyGain || 0), 0);
    res.json({
      funds: results,
      summary: {
        totalCost: Math.round(totalCost * 100) / 10,
        totalCurrent: Math.round(totalCurrent * 100) / 10,
        totalGain: Math.round(totalGain * 100) / 10,
        totalGainRate: totalCost > 0 ? Math.round((totalGain / totalCost * 10000)) / 100 : 0,
        totalDailyGain: Math.round(totalDailyGain * 10) / 100,
        totalDailyGainRate: totalCurrent > 0 ? Math.round((totalDailyGain / totalCurrent * 10000)) / 100 : 0,
        fundCount: results.filter(f => !f.error).length,
        errorCount: results.filter(f => f.error).length,
        updateTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3456;
app.listen(PORT, '0.0.0', () => {
  console.log(`📊 基金看板已启动: http://localhost:${PORT}`);
});
