const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Service = require('./src/models/Service');

dotenv.config();

const servicesData = [
  // FITNESS
  { title: 'Strength Training', category: 'Fitness', description: 'Build muscle, increase strength & power with progressive overload programs.', price: 500, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400' },
  { title: 'Weight Loss', category: 'Fitness', description: 'Lose weight, burn fat & improve overall fitness with science-backed techniques.', price: 500, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400' },
  { title: 'Body Toning', category: 'Fitness', description: 'Sculpt and tone your body with targeted exercises and smart training techniques.', price: 500, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400' },
  { title: 'Kids Fitness', category: 'Fitness', description: 'Fun, safe and age-appropriate fitness programs designed for growing children.', price: 400, durationMinutes: 45, imageUrl: 'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=400' },
  { title: 'Posture Correction', category: 'Fitness', description: 'Correct postural imbalances and improve alignment through targeted therapy.', price: 600, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400' },
  { title: 'Senior Fitness', category: 'Fitness', description: 'Gentle, effective fitness programs for older adults to improve strength and mobility.', price: 500, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400' },
  { title: 'Muscle Gain', category: 'Fitness', description: 'Build lean muscle mass with structured hypertrophy programs and expert guidance.', price: 500, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400' },
  { title: 'Personal Trainer', category: 'Fitness', description: 'One-on-one training sessions with certified personal trainers for maximum results.', price: 800, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400' },
  
  // PHYSIO
  { title: 'Back / Neck / Knee Pain', category: 'Physio', description: 'Relieve pain and improve movement with expert physiotherapy care.', price: 1000, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400' },
  { title: 'Elderly Care', category: 'Physio', description: 'Personalized support to help seniors stay active and independent.', price: 800, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400' },
  { title: 'Home Physiotherapy', category: 'Physio', description: 'Professional physiotherapy treatment at the comfort of your home.', price: 1500, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400' },
  { title: 'Mobility Training', category: 'Physio', description: 'Improve balance, flexibility, and daily movement with guided training.', price: 900, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400' },
  { title: 'Post Surgery Recovery', category: 'Physio', description: 'Speed up recovery and regain strength after surgery safely.', price: 1200, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400' },
  { title: 'Sports Injury Rehab', category: 'Physio', description: 'Recover from sports injuries and return to peak performance faster.', price: 1100, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400' },
  { title: 'Stroke Rehab', category: 'Physio', description: 'Specialized rehabilitation to improve strength and daily functioning after stroke.', price: 1300, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400' },
  
  // SPORTS
  { title: 'Athletics', category: 'Sports', description: 'Improve speed, stamina, agility, and overall athletic performance.', price: 600, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=400' },
  { title: 'Badminton', category: 'Sports', description: 'Enhance reflexes, footwork, and game strategy with expert badminton coaching.', price: 500, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=400' },
  { title: 'Boxing / Kickboxing', category: 'Sports', description: 'Build strength, endurance, and self-defense skills with combat training.', price: 700, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=400' },
  { title: 'Cricket', category: 'Sports', description: 'Professional cricket coaching focused on batting, bowling, and fielding skills.', price: 500, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=400' },
  { title: 'Football', category: 'Sports', description: 'Develop teamwork, stamina, ball control, and match performance.', price: 600, durationMinutes: 90, imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400' },
  { title: 'Karate', category: 'Sports', description: 'Learn discipline, self-defense, flexibility, and martial arts techniques.', price: 500, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1517438476312-10d79c077509?w=400' },
  { title: 'Kids Sports Training', category: 'Sports', description: 'Fun and engaging sports activities designed specially for kids.', price: 450, durationMinutes: 45, imageUrl: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400' },
  { title: 'Running / Marathon', category: 'Sports', description: 'Structured running programs to improve endurance and marathon preparation.', price: 400, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1486218119243-13883505764c?w=400' },
  { title: 'Skating', category: 'Sports', description: 'Learn balance, coordination, and skating techniques from trained professionals.', price: 500, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400' },
  { title: 'Swimming', category: 'Sports', description: 'Professional swimming sessions for fitness, technique, and water confidence.', price: 800, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=400' },
  
  // YOGA
  { title: 'Meditation', category: 'Yoga', description: 'Practice mindfulness & guided meditation techniques to improve mental clarity.', price: 400, durationMinutes: 45, imageUrl: 'https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=400' },
  { title: 'Power Yoga', category: 'Yoga', description: 'High-energy yoga sessions focused on strength, endurance, flexibility.', price: 500, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400' },
  { title: 'Pre / Post Pregnancy Yoga', category: 'Yoga', description: 'Gentle yoga practices designed to support mothers during pregnancy.', price: 800, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=400' },
  { title: 'Stress Relief', category: 'Yoga', description: 'Relaxing yoga & breathing exercises to reduce stress, anxiety & mental fatigue naturally.', price: 500, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400' },
  { title: 'Therapeutic Yoga', category: 'Yoga', description: 'Healing-focused yoga practices designed to support pain relief, recovery & overall wellness.', price: 600, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1518611012118-fbdf8dcb0fd4?w=400' },

  // THERAPY
  { title: 'Acupressure', category: 'Therapy', description: 'Stimulate pressure points to reduce pain and improve circulation.', price: 900, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400' },
  { title: 'Acupuncture', category: 'Therapy', description: 'Traditional therapy using fine needles to restore balance and relieve pain.', price: 1000, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400' },
  { title: 'Cupping Therapy', category: 'Therapy', description: 'Improve blood flow, reduce muscle tension, and support recovery.', price: 1200, durationMinutes: 45, imageUrl: 'https://images.unsplash.com/photo-1518611012118-fb8f2f7db0b7?w=400' },
  { title: 'Detox Therapy', category: 'Therapy', description: 'Cleanse and refresh your body with therapies designed to remove toxins naturally.', price: 1500, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400' },
  { title: 'Naturopathy', category: 'Therapy', description: 'Holistic natural treatments focused on healing through lifestyle and natural remedies.', price: 1100, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=400' },
  { title: 'Touch Healing', category: 'Therapy', description: 'Gentle healing techniques that promote relaxation, balance, and emotional wellness.', price: 800, durationMinutes: 60, imageUrl: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400' },
  
  // NUTRITION
  { title: 'Diabetic Diet', category: 'Nutrition', description: 'Balanced meal plans designed to help manage blood sugar levels.', price: 1500, durationMinutes: 30, imageUrl: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400' },
  { title: 'Kids Diet', category: 'Nutrition', description: 'Healthy and nutritious meal plans specially designed for growing children.', price: 1200, durationMinutes: 30, imageUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400' },
  { title: 'Muscle Gain Diet', category: 'Nutrition', description: 'Protein-rich nutrition plans to support muscle growth, strength, and recovery.', price: 1500, durationMinutes: 30, imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400' },
  { title: 'Online Diet Consultation', category: 'Nutrition', description: 'Get professional nutrition guidance and diet planning from anywhere online.', price: 1000, durationMinutes: 30, imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400' },
  { title: 'PCOS Diet', category: 'Nutrition', description: 'Specialized nutrition plans to support hormone balance and manage PCOS symptoms.', price: 1500, durationMinutes: 30, imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400' },
  { title: 'Sports Nutrition', category: 'Nutrition', description: 'Performance-focused nutrition plans for athletes and active individuals.', price: 1800, durationMinutes: 45, imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=400' },
  { title: 'Weight Loss Diet', category: 'Nutrition', description: 'Healthy and sustainable meal plans designed for effective weight loss.', price: 1500, durationMinutes: 30, imageUrl: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=400' },
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for Seeding...');

    await Service.deleteMany(); 
    console.log('Cleared existing services.');

    await Service.insertMany(servicesData);
    console.log('Successfully seeded database with beautiful services!');
    
    process.exit();
  } catch (err) {
    console.error('Error seeding DB:', err);
    process.exit(1);
  }
};

seedDB();
