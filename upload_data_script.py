import os
import csv
import json
import requests
from datetime import datetime

# ==========================================
# 設定您的 Supabase 環境變數
# ==========================================
SUPABASE_URL = os.environ.get("SUPABASE_URL", "您的_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "您的_SUPABASE_SERVICE_ROLE_KEY_或_ANON_KEY")

# ==========================================
# 輔助函數
# ==========================================
def upload_to_supabase(table_name, payload):
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code in [200, 201]:
        print(f"成功上傳 {len(payload)} 筆資料至 {table_name}")
    else:
        print(f"上傳失敗: {response.status_code}")
        print(response.text)

# ==========================================
# 主程式 (範例：從 CSV 讀取並上傳)
# ==========================================
def main():
    csv_file_path = "your_data.csv" # 替換成您的 CSV 檔案路徑
    
    if not os.path.exists(csv_file_path):
        print(f"找不到檔案 {csv_file_path}，這是一個範例腳本，請修改並提供正確的路徑。")
        return

    full_data = []
    skip_data = []

    with open(csv_file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # 建立基本的 payload
            record = {
                "timestamp": row.get("填寫時間", row.get("時間戳記", datetime.utcnow().isoformat())),
                "region": row.get("區域", row.get("地區", row.get("招生區", ""))),
                "examYear": row.get("會考年度", "114"),
                "identity": row.get("分析身分", row.get("身分", "")),
                "chineseScore": row.get("國文成績", row.get("國文", "")),
                "mathScore": row.get("數學成績", row.get("數學", "")),
                "englishScore": row.get("英文成績", row.get("英文", "")),
                "socialScore": row.get("社會成績", row.get("社會", "")),
                "scienceScore": row.get("自然成績", row.get("自然", "")),
                "essayScore": row.get("作文成績", row.get("作文級分", row.get("作文", ""))),
                "email": row.get("使用者名稱", row.get("電子郵件", row.get("電子郵件地址", row.get("聯絡信箱", row.get("email", row.get("Email", "")))))),
                "inviteCode": row.get("邀請碼", "")
            }
            
            # 解析序位與區間，轉為數字
            min_ratio = row.get("全區序位最小比率(%)", row.get("最小比率(%)"))
            max_ratio = row.get("全區序位最大比率(%)", row.get("最大比率(%)"))
            min_rank = row.get("全區序位最小區間", row.get("最小區間"))
            max_rank = row.get("全區序位最大區間", row.get("最大區間"))
            
            if min_rank and max_rank:
                # 完整資料 (包含序位)
                record["minRatio"] = float(min_ratio) if min_ratio else None
                record["maxRatio"] = float(max_ratio) if max_ratio else None
                record["minRankInterval"] = int(min_rank)
                record["maxRankInterval"] = int(max_rank)
                full_data.append(record)
            else:
                # 無序位資料
                skip_data.append(record)

    # 批次上傳至不同的資料表
    if full_data:
        # Supabase API 一次建議不要超過 1000 筆，可自行分批
        upload_to_supabase("survey_responses_full", full_data)
        
    if skip_data:
        upload_to_supabase("survey_responses_skip_ranking", skip_data)

if __name__ == "__main__":
    print("準備執行上傳...")
    # main() # 取消註解以執行
