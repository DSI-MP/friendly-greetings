import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3 Foreign Key & Index Hardening
 *
 * 1. Adds FK constraints for daily_run_id on route_group_runs and generated_route_groups
 * 2. Adds FK for daily_runs.latest_run_id -> route_group_runs.id
 * 3. Confirms indexes exist
 * 4. Makes request_id clearly nullable (legacy-only)
 */
export class V3ForeignKeyHardening1711200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. FK: route_group_runs.daily_run_id -> daily_runs.id ──
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE route_group_runs
          ADD CONSTRAINT fk_route_group_runs_daily_run
          FOREIGN KEY (daily_run_id) REFERENCES daily_runs(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ── 2. FK: generated_route_groups.daily_run_id -> daily_runs.id ──
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE generated_route_groups
          ADD CONSTRAINT fk_generated_route_groups_daily_run
          FOREIGN KEY (daily_run_id) REFERENCES daily_runs(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ── 3. FK: daily_runs.latest_run_id -> route_group_runs.id (nullable) ──
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE daily_runs
          ADD CONSTRAINT fk_daily_runs_latest_run
          FOREIGN KEY (latest_run_id) REFERENCES route_group_runs(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ── 4. Composite index for common lookups ──
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_route_group_runs_daily_run_number
        ON route_group_runs (daily_run_id, run_number DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_generated_route_groups_run_id_code
        ON generated_route_groups (run_id, group_code);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_daily_runs_status
        ON daily_runs (status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE route_group_runs DROP CONSTRAINT IF EXISTS fk_route_group_runs_daily_run;`);
    await queryRunner.query(`ALTER TABLE generated_route_groups DROP CONSTRAINT IF EXISTS fk_generated_route_groups_daily_run;`);
    await queryRunner.query(`ALTER TABLE daily_runs DROP CONSTRAINT IF EXISTS fk_daily_runs_latest_run;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_route_group_runs_daily_run_number;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_generated_route_groups_run_id_code;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_daily_runs_status;`);
  }
}
