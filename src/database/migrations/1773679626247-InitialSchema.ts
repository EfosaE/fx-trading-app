import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1773679626247 implements MigrationInterface {
    name = 'InitialSchema1773679626247'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "wallet_balances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "currency" character varying(3) NOT NULL, "balance" numeric(20,6) NOT NULL DEFAULT '0', "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_eebe2c6f13f1a2de3457f8a885c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8cdb4d0c080c353c14479741d6" ON "wallet_balances" ("user_id", "currency") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "otp_code" character varying, "is_verified" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_type_enum" AS ENUM('FUNDING', 'CONVERSION', 'TRADE')`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_status_enum" AS ENUM('PENDING', 'COMPLETED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "wallet_balance_id" uuid, "fx_rate_id" uuid, "type" "public"."transactions_type_enum" NOT NULL, "from_currency" character varying(3), "to_currency" character varying(3), "from_amount" numeric(20,6) NOT NULL, "to_amount" numeric(20,6), "rate_used" numeric(20,8), "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'PENDING', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "fx_rates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "base_currency" character varying(3) NOT NULL, "target_currency" character varying(3) NOT NULL, "rate" numeric(20,8) NOT NULL, "fetched_at" TIMESTAMP NOT NULL DEFAULT now(), "expires_at" TIMESTAMP NOT NULL, CONSTRAINT "PK_94eb17e7eddb6df0cec5985ea5f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "wallet_balances" ADD CONSTRAINT "FK_d7a7068b8383c63588d1c7acc40" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_f26ff7f279ddca0860ceb73465c" FOREIGN KEY ("wallet_balance_id") REFERENCES "wallet_balances"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_154147997e1df8a7fce330b9757" FOREIGN KEY ("fx_rate_id") REFERENCES "fx_rates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_154147997e1df8a7fce330b9757"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_f26ff7f279ddca0860ceb73465c"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b"`);
        await queryRunner.query(`ALTER TABLE "wallet_balances" DROP CONSTRAINT "FK_d7a7068b8383c63588d1c7acc40"`);
        await queryRunner.query(`DROP TABLE "fx_rates"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8cdb4d0c080c353c14479741d6"`);
        await queryRunner.query(`DROP TABLE "wallet_balances"`);
    }

}
