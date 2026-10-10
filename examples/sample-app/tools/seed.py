from seed_data import DEMO_ORDERS
from logger import log_info


def seed_demo_orders():
    log_info('seeding demo orders')
    return DEMO_ORDERS


if __name__ == "__main__":
    seed_demo_orders()
