require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Trust proxy for accurate IP in audit logs
app.set('trust proxy', 1);

app.use('/api/auth',             require('./routes/auth'));
app.use('/api/contacts',         require('./routes/contacts'));
app.use('/api/deals',            require('./routes/deals'));
app.use('/api/funnels',          require('./routes/funnels'));
app.use('/api/users',            require('./routes/users'));
app.use('/api/win-loss-reasons', require('./routes/winLossReasons'));
app.use('/api/activities',       require('./routes/activities'));
app.use('/api/tasks',            require('./routes/tasks'));
app.use('/api/custom-fields',    require('./routes/customFields'));
app.use('/api/products',         require('./routes/products'));
app.use('/api/settings',         require('./routes/appSettings'));
app.use('/api/teams',            require('./routes/teams'));
app.use('/api/companies',        require('./routes/companies'));
app.use('/api/company-attrs',    require('./routes/companyAttributes'));
app.use('/api/locations',        require('./routes/locations'));
app.use('/api/admin/finance',    require('./routes/finance'));
app.use('/api/payment-webhooks', require('./routes/paymentWebhooks'));
app.use('/api/acl-profiles',     require('./routes/aclProfiles'));
app.use('/api/audit',            require('./routes/auditLogs'));

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
