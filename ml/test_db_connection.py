from sqlalchemy import create_engine, text

DB_URL = "mysql+pymysql://root:123456@127.0.0.1:3307/apple_repair_service"

try:
    engine = create_engine(DB_URL)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT DATABASE();")).fetchone()
        print(f"✅ KẾT NỐI THÀNH CÔNG RỒI! Đang kết nối tới Database: '{result[0]}'")
except Exception as e:
    print(f"❌ KẾT NỐI THẤT BẠI!")
    print(f"Lỗi chi tiết: {e}")