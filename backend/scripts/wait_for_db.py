"""Block until the database accepts connections (used by the Docker entrypoint)."""
import sys
import time

from sqlalchemy import create_engine, text

from app.core.config import settings

TIMEOUT = 90


def main() -> None:
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    start = time.time()
    while True:
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("Database is ready.")
            return
        except Exception as exc:  # noqa: BLE001
            if time.time() - start > TIMEOUT:
                print(f"Database not reachable after {TIMEOUT}s: {exc}", file=sys.stderr)
                sys.exit(1)
            print("Waiting for database...")
            time.sleep(2)


if __name__ == "__main__":
    main()
