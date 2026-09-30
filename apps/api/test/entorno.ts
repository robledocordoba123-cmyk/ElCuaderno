// Las pruebas usan su propia base de datos para no tocar los datos de desarrollo.
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgresql://elcuaderno:elcuaderno_dev@localhost:5434/elcuaderno_test';
process.env.JWT_SECRET = 'secreto-solo-para-pruebas-0123456789-abcdefghij';
process.env.CORS_ORIGIN = 'http://localhost:5174';
