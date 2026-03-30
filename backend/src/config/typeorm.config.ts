import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getTypeOrmConfig = (config: ConfigService): TypeOrmModuleOptions => {
  const nodeEnv = config.get<string>('nodeEnv', 'development');
  const dbUrl = config.get<string>('database.url');
  const autoCreate = config.get<boolean>('database.autoCreateTables', false);
  const dropAndRecreate = config.get<boolean>('database.dropAndRecreate', false);

  if (dropAndRecreate && nodeEnv === 'production') {
    throw new Error('DB_DROP_AND_RECREATE=true is forbidden in production!');
  }

  return {
    type: 'postgres',
    url: dbUrl,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
    synchronize: autoCreate,
    dropSchema: dropAndRecreate && nodeEnv !== 'production',
    migrationsRun: config.get<boolean>('database.runMigrations', false),
    logging: nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
  };
};
