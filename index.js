// Middleware
app.use(express.json());

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if(!origin) return callback(null, true);
    
    // Allow all origins in development
    if(process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // In production, check against allowed origins
    const allowedOrigins = [
      process.env.CLIENT_URL,
      'https://client-g2sa50oun-akhashcs24s-projects.vercel.app',
      'https://client-qu0ey0h2i-akhashcs24s-projects.vercel.app',
      'https://client-izlts6arf-akhashcs24s-projects.vercel.app',
      'https://client-6i8iqnepg-akhashcs24s-projects.vercel.app'
    ];
    
    if(allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // For testing, allow all origins
      callback(null, true);
      // Uncomment below to restrict origins
      // callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client/dist'))); 