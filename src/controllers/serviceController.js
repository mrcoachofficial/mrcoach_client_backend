const Service = require('../models/Service');
const Config = require('../models/Config');

// @desc    Fetch all services
// @route   GET /api/services
// @access  Public (Anyone can see the services)
const getServices = async (req, res) => {
  try {
    const services = await Service.find({});
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Fetch a single service by ID
// @route   GET /api/services/:id
// @access  Public
const getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (service) {
      res.json(service);
    } else {
      res.status(404).json({ message: 'Service not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new service
// @route   POST /api/services
// @access  Private/Admin (Only Admins can add new services to the app)
const createService = async (req, res) => {
  try {
    const { title, description, category, price, durationMinutes, imageUrl } = req.body;

    const service = new Service({
      title,
      description,
      category,
      price,
      durationMinutes,
      imageUrl
    });

    const createdService = await service.save();
    res.status(201).json(createdService);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a service
// @route   PUT /api/services/:id
// @access  Private/Admin
const updateService = async (req, res) => {
  try {
    const { title, description, category, price, durationMinutes, imageUrl } = req.body;
    
    const service = await Service.findById(req.params.id);

    if (service) {
      service.title = title || service.title;
      service.description = description || service.description;
      service.category = category || service.category;
      service.price = price || service.price;
      service.durationMinutes = durationMinutes || service.durationMinutes;
      service.imageUrl = imageUrl || service.imageUrl;

      const updatedService = await service.save();
      res.json(updatedService);
    } else {
      res.status(404).json({ message: 'Service not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a service
// @route   DELETE /api/services/:id
// @access  Private/Admin
const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (service) {
      await Service.deleteOne({ _id: service._id });
      res.json({ message: 'Service removed permanently' });
    } else {
      res.status(404).json({ message: 'Service not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get services hero image
// @route   GET /api/services/hero-image
// @access  Public
const getServicesHeroImage = async (req, res) => {
  try {
    const config = await Config.findOne({ key: 'servicesHeroImage' });
    res.json({ imageUrl: config ? config.value : '' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  getServicesHeroImage
};
