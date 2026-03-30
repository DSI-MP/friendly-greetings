import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V3 Schema Hardening Migration
 *
 * 1. Creates daily_runs table
 * 2. Adds daily_run_id to route_group_runs and generated_route_groups
 * 3. Adds V3 routing columns to groups and members
 *
 * All new columns are nullable for backward compatibility.
 */
export class V3SchemaHardening1711100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Create daily_runs table ──
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE daily_run_status AS ENUM (
          'OPEN', 'LOCKED', 'GROUPED', 'ASSIGNING', 'READY',
          'SUBMITTED_TO_HR', 'DISPATCHED', 'CLOSED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS daily_runs (
        id SERIAL PRIMARY KEY,
        run_date DATE NOT NULL UNIQUE,
        status daily_run_status NOT NULL DEFAULT 'OPEN',
        included_request_ids JSONB,
        request_count INT NOT NULL DEFAULT 0,
        department_count INT NOT NULL DEFAULT 0,
        total_employees INT NOT NULL DEFAULT 0,
        unresolved_count INT NOT NULL DEFAULT 0,
        routing_source VARCHAR(50),
        routing_warning TEXT,
        grouping_summary TEXT,
        parameters JSONB,
        created_by INT,
        locked_by INT,
        locked_at TIMESTAMP,
        grouped_at TIMESTAMP,
        submitted_to_hr_at TIMESTAMP,
        total_groups INT NOT NULL DEFAULT 0,
        latest_run_id INT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_daily_runs_run_date ON daily_runs (run_date);
    `);

    // ── 2. Add daily_run_id to route_group_runs ──
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE route_group_runs ADD COLUMN daily_run_id INT;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_route_group_runs_daily_run_id ON route_group_runs (daily_run_id);
    `);

    // Make request_id nullable (was NOT NULL before)
    await queryRunner.query(`
      ALTER TABLE route_group_runs ALTER COLUMN request_id DROP NOT NULL;
    `);

    // ── 3. Add daily_run_id to generated_route_groups ──
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE generated_route_groups ADD COLUMN daily_run_id INT;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_generated_route_groups_daily_run_id ON generated_route_groups (daily_run_id);
    `);

    // Make request_id nullable
    await queryRunner.query(`
      ALTER TABLE generated_route_groups ALTER COLUMN request_id DROP NOT NULL;
    `);

    // ── 4. Add V3 routing columns to generated_route_groups ──
    const groupCols = [
      { name: 'estimated_distance_km', type: 'DECIMAL(10,2)' },
      { name: 'estimated_duration_seconds', type: 'INT' },
      { name: 'route_geometry', type: 'JSONB' },
      { name: 'routing_source', type: 'VARCHAR(30)' },
      { name: 'corridor_label', type: 'VARCHAR(100)' },
      { name: 'corridor_code', type: 'VARCHAR(10)' },
    ];

    for (const col of groupCols) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE generated_route_groups ADD COLUMN ${col.name} ${col.type};
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);
    }

    // ── 5. Add V3 routing columns to generated_route_group_members ──
    const memberCols = [
      { name: 'depot_distance_km', type: 'DECIMAL(10,2)' },
      { name: 'depot_duration_seconds', type: 'INT' },
    ];

    for (const col of memberCols) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE generated_route_group_members ADD COLUMN ${col.name} ${col.type};
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);
    }

    // ── 6. Add V3 routing columns to route_group_runs ──
    const runCols = [
      { name: 'routing_source', type: 'VARCHAR(50)' },
      { name: 'routing_warning', type: 'TEXT' },
    ];

    for (const col of runCols) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE route_group_runs ADD COLUMN ${col.name} ${col.type};
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);
    }

    // ── 7. Backfill existing runs with daily_run_id where possible ──
    await queryRunner.query(`
      UPDATE route_group_runs r
      SET daily_run_id = d.id
      FROM daily_runs d
      WHERE r.daily_run_id IS NULL
        AND r.parameters IS NOT NULL
        AND r.parameters->>'date' IS NOT NULL
        AND d.run_date = (r.parameters->>'date')::date;
    `);

    await queryRunner.query(`
      UPDATE generated_route_groups g
      SET daily_run_id = r.daily_run_id
      FROM route_group_runs r
      WHERE g.daily_run_id IS NULL
        AND g.run_id = r.id
        AND r.daily_run_id IS NOT NULL;
    `);

    // ── 8. Backfill daily_runs.latest_run_id from newest run per date ──
    await queryRunner.query(`
      UPDATE daily_runs d
      SET latest_run_id = sub.run_id
      FROM (
        SELECT DISTINCT ON (daily_run_id) daily_run_id, id AS run_id
        FROM route_group_runs
        WHERE daily_run_id IS NOT NULL
        ORDER BY daily_run_id, run_number DESC
      ) sub
      WHERE d.id = sub.daily_run_id
        AND (d.latest_run_id IS NULL OR d.latest_run_id != sub.run_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE generated_route_group_members DROP COLUMN IF EXISTS depot_distance_km;`);
    await queryRunner.query(`ALTER TABLE generated_route_group_members DROP COLUMN IF EXISTS depot_duration_seconds;`);
    await queryRunner.query(`ALTER TABLE generated_route_groups DROP COLUMN IF EXISTS daily_run_id;`);
    await queryRunner.query(`ALTER TABLE generated_route_groups DROP COLUMN IF EXISTS estimated_distance_km;`);
    await queryRunner.query(`ALTER TABLE generated_route_groups DROP COLUMN IF EXISTS estimated_duration_seconds;`);
    await queryRunner.query(`ALTER TABLE generated_route_groups DROP COLUMN IF EXISTS route_geometry;`);
    await queryRunner.query(`ALTER TABLE generated_route_groups DROP COLUMN IF EXISTS routing_source;`);
    await queryRunner.query(`ALTER TABLE generated_route_groups DROP COLUMN IF EXISTS corridor_label;`);
    await queryRunner.query(`ALTER TABLE generated_route_groups DROP COLUMN IF EXISTS corridor_code;`);
    await queryRunner.query(`ALTER TABLE route_group_runs DROP COLUMN IF EXISTS daily_run_id;`);
    await queryRunner.query(`ALTER TABLE route_group_runs DROP COLUMN IF EXISTS routing_source;`);
    await queryRunner.query(`ALTER TABLE route_group_runs DROP COLUMN IF EXISTS routing_warning;`);
    await queryRunner.query(`DROP TABLE IF EXISTS daily_runs;`);
    await queryRunner.query(`DROP TYPE IF EXISTS daily_run_status;`);
  }
}
