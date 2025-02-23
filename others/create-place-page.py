import requests
import pandas as pd

# ✅ 1. ตั้งค่า API ของ Wiki.js
WIKI_API_URL = "http://localhost:3000/graphql"  # เปลี่ยนเป็น URL ของ Wiki.js
API_KEY = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcGkiOjEsImdycCI6MSwiaWF0IjoxNzM4MDQwMzI2LCJleHAiOjE3Njk1OTc5MjYsImF1ZCI6InVybjp3aWtpLmpzIiwiaXNzIjoidXJuOndpa2kuanMifQ.DargU97ydEqAM27mn78qXvOffPtQsqTLGEJ3kc7fMhA3JC6vfbFQB34A8O9q9dPWb4oFkyyknsp0BREF7elR6MzdqvH8z6zE99XH-ALhKQO9ucqn4Vs19vhGeEsatdVheMlEFgstxKdpgxVUs06xfG3oYukHb913MhMUqKgye_3Zu1xZzaPDJxndngF1keTEMq7p0h-3ORatVogHhyXE_KdcyDmRj1Psqq9OF08TpCq2sgVPccffM6ah3L2VMoTNL5pWDn78ea4bnOHf9X9DkTo2_cc4KMQUcX_JfowoBygkOEs2PRPiD9SaNmAZ1mAUsvVpL0apEKoWQqmWJAj6VQ"  # 🔥 เปลี่ยนเป็น API Key ของคุณ

# ✅ 2. โหลดไฟล์ CSV
provinces = pd.read_csv("./thai_provinces.csv")
amphures = pd.read_csv("./thai_amphures.csv")
tambons = pd.read_csv("./thai_tambons.csv")

# ✅ 3. ฟังก์ชันเรียก GraphQL API เพื่อสร้างหน้า Wiki.js
def create_wiki_page(path, title, content=""):
    query = """
    mutation {
      pages {
        create(
          content: "%s"
          description: "หน้านี้ถูกสร้างอัตโนมัติ"
          editor: "wysiwyg"
          isPublished: true
          isPrivate: false
          locale: "th"
          path: "%s"
          tags: ["จังหวัด", "อำเภอ", "ตำบล"]
          title: "%s"
        ) {
          page {
            id
            path
            title
          }
          responseResult {
            succeeded
            message
          }
        }
      }
    }
    """ % (content, path, title)

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    response = requests.post(WIKI_API_URL, json={"query": query}, headers=headers)
    result = response.json()

    if result.get("data", {}).get("pages", {}).get("create", {}).get("responseResult", {}).get("succeeded"):
        print(f"✅ Created: {path}")
    else:
        print(f"❌ Failed: {path}, Error: {result}")

# ✅ 4. Loop สร้างหน้า Wiki.js สำหรับทุกตำบล
# for _, tambon in tambons.iterrows():
#     amphure = amphures[amphures['id'] == tambon['amphure_id']].iloc[0]
#     province = provinces[provinces['id'] == amphure['province_id']].iloc[0]

#     path = f"สถานที่/{province['name_th']}/{amphure['name_th']}/{tambon['name_th']}"
#     title = f"ตำบล{tambon['name_th']}"

#     print(path, ":", title)
#     # create_wiki_page(path, title)

for _, tambon in tambons.iterrows():
    amphure_match = amphures[amphures['id'] == tambon['amphure_id']]

    if amphure_match.empty:
        print(f"⚠️ ไม่พบอำเภอสำหรับ {tambon['name_th']} (amphure_id: {tambon['amphure_id']})")
        continue  # ข้ามไปตำบลถัดไป

    amphure = amphure_match.iloc[0]
    province_match = provinces[provinces['id'] == amphure['province_id']]

    if province_match.empty:
        print(f"⚠️ ไม่พบจังหวัดสำหรับ {amphure['name_th']} (province_id: {amphure['province_id']})")
        continue  # ข้ามไปตำบลถัดไป

    province = province_match.iloc[0]

    path = f"สถานที่/{province['name_th']}/{amphure['name_th']}/{tambon['name_th']}"
    title = f"ตำบล{tambon['name_th']}"

    print(path, ":", title)

    # create_wiki_page(path, title)
