import { MigrationInterface, QueryRunner } from 'typeorm';

export class OtpHashingAndAttempts1711500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Expand otp column to hold bcrypt hashes (60 chars)
    await queryRunner.query(`
      ALTER TABLE password_reset_requests
      ALTER COLUMN otp TYPE varchar(255)
    `);

    // Add attempt counter for brute-force protection
    await queryRunner.query(`
      ALTER TABLE password_reset_requests
      ADD COLUMN IF NOT EXISTS otp_attempts int DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE password_reset_requests
      DROP COLUMN IF EXISTS otp_attempts
    `);

    await queryRunner.query(`
      ALTER TABLE password_reset_requests
      ALTER COLUMN otp TYPE varchar(10)
    `);
  }
}
