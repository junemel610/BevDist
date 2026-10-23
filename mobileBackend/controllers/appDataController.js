const { loadAppData } = require('../models/app-data');
const appDataController = pool => async (req, res) => res.json(await loadAppData(pool));
module.exports = { appDataController };
