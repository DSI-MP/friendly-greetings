import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintGroupMembers1711400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove any existing duplicate rows before adding the constraint
    await queryRunner.query(`
      DELETE FROM generated_route_group_members a
      USING generated_route_group_members b
      WHERE a.id > b.id
        AND a.generated_group_id = b.generated_group_id
        AND a.employee_id = b.employee_id
    `);

    // Add unique constraint to prevent future duplicates
    await queryRunner.query(`
      ALTER TABLE generated_route_group_members
      ADD CONSTRAINT uq_group_member_employee UNIQUE (generated_group_id, employee_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE generated_route_group_members
      DROP CONSTRAINT IF EXISTS uq_group_member_employee
    `);
  }
}
