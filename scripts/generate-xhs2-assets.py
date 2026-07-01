from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path("marketing-assets")
OUT.mkdir(exist_ok=True)
FONT_DIR = Path("C:/Windows/Fonts")


def fontfile(names):
    for name in names:
        path = FONT_DIR / name
        if path.exists():
            return str(path)
    return str(FONT_DIR / "arial.ttf")


ZH = lambda size: ImageFont.truetype(fontfile(["msyh.ttc", "NotoSansSC-VF.ttf", "simhei.ttf", "simsun.ttc"]), size)
ZHB = lambda size: ImageFont.truetype(fontfile(["msyhbd.ttc", "simhei.ttf", "NotoSansSC-VF.ttf", "msyh.ttc"]), size)
MONO = lambda size: ImageFont.truetype(fontfile(["consola.ttf", "cour.ttf"]), size)

W, H = 1080, 1440
INK = (15, 23, 42)
MUTED = (100, 116, 139)
BLUE = (37, 99, 235)
BG = (248, 250, 252)
LINE = (218, 226, 235)
DARK = (13, 18, 28)
DARK2 = (21, 29, 43)
GREEN = (22, 163, 74)
AMBER = (217, 119, 6)
RED = (220, 38, 38)
WHITE = (255, 255, 255)


def base():
    image = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(image)
    d.ellipse((-180, 1120, 360, 1660), fill=(219, 242, 252))
    d.ellipse((760, -210, 1280, 320), fill=(220, 232, 255))
    d.ellipse((760, 1110, 1360, 1620), fill=(232, 240, 255))
    for x in range(80, W, 160):
        for y in range(80, H, 160):
            d.ellipse((x, y, x + 4, y + 4), fill=(226, 234, 244))
    return image


def logo(d):
    d.rounded_rectangle((70, 70, 118, 118), radius=13, fill=INK)
    d.text((136, 76), "RepoReady", font=ZHB(31), fill=INK)


def wrap_draw(d, text, x, y, font, fill, max_width, line_gap=8):
    lines = []
    cur = ""
    for ch in text:
        trial = cur + ch
        if d.textbbox((0, 0), trial, font=font)[2] <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    for line in lines:
        d.text((x, y), line, font=font, fill=fill)
        box = d.textbbox((x, y), line, font=font)
        y += box[3] - box[1] + line_gap
    return y


def pill(d, x, y, text, font=None, w=None):
    font = font or MONO(30)
    box = d.textbbox((0, 0), text, font=font)
    tw = box[2] - box[0]
    th = box[3] - box[1]
    w = w or tw + 58
    h = th + 34
    d.rounded_rectangle((x, y, x + w, y + h), radius=22, fill=DARK)
    d.text((x + 28, y + 16), text, font=font, fill=(241, 245, 249))
    return y + h


def terminal(d, x, y, w, h):
    d.rounded_rectangle((x + 10, y + 16, x + w + 10, y + h + 16), radius=30, fill=(216, 225, 236))
    d.rounded_rectangle((x, y, x + w, y + h), radius=30, fill=DARK)
    d.rounded_rectangle((x, y, x + w, y + 58), radius=30, fill=DARK2)
    for i, c in enumerate([(98, 115, 140), (75, 93, 118), (56, 72, 96)]):
        d.ellipse((x + 32 + i * 28, y + 23, x + 46 + i * 28, y + 37), fill=c)
    yy = y + 90
    d.text((x + 42, yy), "RepoReady 报告 - my-repo", font=ZH(27), fill=(237, 242, 249))
    yy += 70
    for k, v in [("总分", "92/100"), ("Agent Ready", "88/100"), ("Safety", "100/100")]:
        d.text((x + 42, yy), k, font=ZH(25) if k == "总分" else MONO(25), fill=(96, 165, 250) if k == "总分" else (237, 242, 249))
        d.text((x + 360, yy), v, font=MONO(25), fill=(237, 242, 249))
        yy += 45
    yy += 25
    d.text((x + 42, yy), "Agent Failure Risk", font=MONO(25), fill=(147, 197, 253))
    yy += 45
    d.text((x + 42, yy), "HIGH", font=MONO(25), fill=(250, 204, 21))
    d.text((x + 165, yy), "Validation Gap", font=MONO(25), fill=(250, 204, 21))


def card(d, x, y, w, h, title, body, color=BLUE):
    d.rounded_rectangle((x, y, x + w, y + h), radius=30, fill=WHITE, outline=LINE, width=2)
    d.ellipse((x + 34, y + 36, x + 62, y + 64), fill=color)
    d.text((x + 84, y + 28), title, font=ZHB(31), fill=INK)
    wrap_draw(d, body, x + 84, y + 78, ZH(25), MUTED, w - 120, 8)


def save_cover():
    image = base()
    d = ImageDraw.Draw(image)
    logo(d)
    wrap_draw(d, "不是 AI 改不好代码", 70, 210, ZHB(68), INK, 920, 12)
    wrap_draw(d, "是你的仓库没准备好", 70, 390, ZHB(68), BLUE, 920, 12)
    wrap_draw(d, "用 Codex / Claude Code / Cursor 前，先跑一次仓库体检。", 70, 580, ZH(34), MUTED, 880, 10)
    pill(d, 70, 720, "npx @shidesheng0218/repo-ready@latest", MONO(29), 940)
    terminal(d, 90, 865, 900, 410)
    d.text((70, 1325), "开源工具 RepoReady  ·  GitHub / npm", font=ZH(28), fill=MUTED)
    image.save(OUT / "xhs-2-01-cover.png", quality=95)


def save_reasons():
    image = base()
    d = ImageDraw.Draw(image)
    logo(d)
    d.text((70, 190), "AI Agent 最容易失败的", font=ZHB(54), fill=INK)
    d.text((70, 265), "5 个原因", font=ZHB(72), fill=BLUE)
    items = ["没有 AGENTS.md", "没有测试命令", "README 写得不清楚", "仓库上下文太乱", "存在危险脚本"]
    colors = [RED, AMBER, BLUE, BLUE, RED]
    y = 420
    for i, item in enumerate(items):
        card(d, 70, y, 940, 125, str(i + 1), item, colors[i])
        y += 150
    wrap_draw(d, "这些问题会让 AI 读错文件、改错模块，或者无法验证修改。", 70, 1250, ZH(30), MUTED, 900, 8)
    image.save(OUT / "xhs-2-02-failure-reasons.png", quality=95)


def save_command():
    image = base()
    d = ImageDraw.Draw(image)
    logo(d)
    d.text((70, 190), "一行命令", font=ZHB(72), fill=INK)
    d.text((70, 280), "给仓库做体检", font=ZHB(72), fill=BLUE)
    wrap_draw(d, "不需要服务器，不需要登录，不需要 AI API key。", 70, 420, ZH(34), MUTED, 900, 10)
    pill(d, 70, 560, "npx @shidesheng0218/repo-ready@latest", MONO(29), 940)
    pill(d, 70, 660, "npx @shidesheng0218/repo-ready@latest --lang zh", MONO(27), 940)
    terminal(d, 90, 830, 900, 410)
    d.text((70, 1310), "适合开源维护者 / AI 编程重度用户", font=ZH(28), fill=MUTED)
    image.save(OUT / "xhs-2-03-command-demo.png", quality=95)


def save_report():
    image = base()
    d = ImageDraw.Draw(image)
    logo(d)
    d.text((70, 180), "报告里看什么？", font=ZHB(70), fill=INK)
    card(d, 70, 330, 940, 150, "Agent Failure Risk", "预测 AI 最可能在哪里失败", AMBER)
    card(d, 70, 520, 940, 150, "Evidence Chain", "不只给分数，还告诉你证据来自哪里", BLUE)
    card(d, 70, 710, 940, 150, "Fix PR Plan", "把修复分成 safe / review / manual", GREEN)
    card(d, 70, 900, 940, 150, "Safety Boundary", "危险脚本只提醒，不自动执行", RED)
    wrap_draw(d, "目标不是让 AI 乱改，而是让 AI 改得更可审查。", 70, 1190, ZHB(34), INK, 900, 10)
    image.save(OUT / "xhs-2-04-report-guide.png", quality=95)


def save_cta():
    image = base()
    d = ImageDraw.Draw(image)
    logo(d)
    d.text((70, 190), "如果你经常用 AI 写代码", font=ZHB(54), fill=INK)
    d.text((70, 280), "先跑一下 RepoReady", font=ZHB(64), fill=BLUE)
    wrap_draw(d, "它会检查你的仓库是否适合 Codex / Claude Code / Cursor 修改。", 70, 410, ZH(33), MUTED, 900, 10)
    pill(d, 70, 560, "npx @shidesheng0218/repo-ready@latest", MONO(29), 940)
    card(d, 70, 720, 940, 145, "开源项目", "GitHub: shidesheng0218/repo-ready", BLUE)
    card(d, 70, 895, 940, 145, "npm", "@shidesheng0218/repo-ready", GREEN)
    wrap_draw(d, "试完后可以把报告截图发出来，看看你的仓库准备好了没有。", 70, 1120, ZHB(32), INK, 900, 10)
    image.save(OUT / "xhs-2-05-cta.png", quality=95)


if __name__ == "__main__":
    save_cover()
    save_reasons()
    save_command()
    save_report()
    save_cta()
    print("generated xhs second post assets")
