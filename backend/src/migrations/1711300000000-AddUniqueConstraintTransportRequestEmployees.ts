import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintTransportRequestEmployees1711300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove any existing duplicate rows before adding the constraint
    await queryRunner.query(`
      DELETE FROM transport_request_employees a
      USING transport_request_employees b
      WHERE a.id > b.id
        AND a.request_id = b.request_id
        AND a.employee_id = b.employee_id
    `);

    // Add unique constraint to prevent future duplicates
    await queryRunner.query(`
      ALTER TABLE transport_request_employees
      ADD CONSTRAINT uq_request_employee UNIQUE (request_id, employee_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE transport_request_employees
      DROP CONSTRAINT IF EXISTS uq_request_employee
    `);
  }
}
