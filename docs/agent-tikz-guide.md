# Hướng dẫn tạo hình vẽ TikZ cho AI Agent

Tài liệu này dành cho AI Agent (hoặc người) viết bài blog có sơ đồ hình học, đồ
thị, sơ đồ luồng, v.v. **Đọc kỹ phần "Quy tắc escape" và "Lỗi thường gặp"** —
đó là nguyên nhân 100% các lỗi hình không hiện hoặc hiện sai.

---

## Tóm tắt cho Agent (dán vào system prompt)

```
Khi tạo bài có sơ đồ hình học/đồ thị trên blog maths-blog:
1. bodyMarkdown là Markdown. Sơ đồ để trong code block: ba dấu backtick + tikz
2. Bên trong: mã TikZ chuẩn (như Overleaf/LaTeX), chỉ phần thân
   \begin{tikzpicture} ... \end{tikzpicture}
3. KHÔNG gửi \documentclass, \usepackage, \begin{document} — blog tự thêm
4. Backslash ĐƠN trong mã nguồn: \draw, \node, \fill — KHÔNG phải \\draw
5. Mỗi lệnh TikZ kết thúc bằng dấu chấm phẩy ;
6. Thư viện có sẵn: arrows.meta, calc, decorations.pathreplacing,
   positioning, shapes.geometric (không cần \usetikzlibrary)
7. Hình được compile bằng LaTeX thật (xelatex) khi lưu bài → SVG chất lượng Overleaf
8. Unicode OK: tiếng Việt, dấu phụ, CJK đều render được
9. SAI escape → hình trống hoặc vỡ. ĐÚNG → sơ đồ đẹp như sách giáo khoa
```

---

## Cấu trúc một bài có hình

Bài viết = Markdown. Phần hình nằm trong code block đánh dấu `tikz`:

````markdown
## Định lý Pythagoras

Xét tam giác vuông tại $A$:

```tikz
\begin{tikzpicture}[thick]
  \fill[blue!15] (0,0) -- (4,0) -- (0,3) -- cycle;
  \draw (0,0) -- (4,0) -- (0,3) -- cycle;
  \draw (0.3,0) -- (0.3,0.3) -- (0,0.3);
  \node[below left]  at (0,0) {$A$};
  \node[below right] at (4,0) {$B$};
  \node[above left]  at (0,3) {$C$};
  \node[below]       at (2,0) {$b$};
  \node[left]        at (0,1.5) {$a$};
  \node[above right] at (2,1.5) {$c$};
\end{tikzpicture}
```

Khi đó $a^2 + b^2 = c^2$.
````

Toàn bộ nội dung hình nằm giữa cặp `` ```tikz `` và `` ``` ``. Blog sẽ tự động
bọc trong `\documentclass{standalone}` + `\usepackage{tikz}` + các thư viện.

---

## Quy tắc escape (QUAN TRỌNG NHẤT)

Đây là lỗi phổ biến nhất, gây ra **hình trống** hoặc **hình vỡ** (chữ chồng chất).

### Nguyên tắc

TikZ dùng **backslash đơn** (`\draw`). Khi chuỗi đó được gửi qua HTTP/JSON, mỗi
`\` phải được viết thành `\\` — NHƯNG bộ mã hóa JSON **tự động làm việc này**.
**KHÔNG tự nhân đôi backslash thủ công.**

| Bạn muốn vẽ | Trong mã TikZ (bodyMarkdown) | Trong JSON gửi đi (tự động) |
|-------------|------------------------------|----------------------------|
| vẽ đường    | `\draw`                      | `\\draw`                   |
| đặt nhãn    | `\node`                      | `\\node`                   |
| tô màu      | `\fill`                      | `\\fill`                   |
| bắt đầu     | `\begin{tikzpicture}`       | `\\begin{tikzpicture}`    |

### Cách tránh lỗi

| Ngôn ngữ | Cách viết mã TikZ | Lý do |
|----------|-------------------|-------|
| **Python** | `r"\draw ..."` (raw string) + gửi qua `json=...` | `json=` tự escape `\` → `\\` |
| **Node.js** | ``String.raw`\draw ...` `` + `JSON.stringify` | `JSON.stringify` tự escape |
| **Shell/curl** | đọc body từ **file** (`--data @file`) | tránh shell escape |

### Dấu hiệu nhận biết lỗi escape

- Hình trống, hoặc chỉ hiện 1-2 ký tự text lộn xộn
- Console trình duyệt: `Missing svg element` hoặc WASM error `unreachable`
- Hình hiện nhưng chỉ là text vỡ (chữ chồng lên nhau)

---

## Quy tắc bắt buộc khi viết TikZ

| Quy tắc | Giải thích |
|---------|------------|
| **Chỉ gửi phần thân** `\begin{tikzpicture}...\end{tikzpicture}` | Blog tự thêm documentclass/usepackage |
| **Mỗi lệnh kết thúc bằng `;`** | `\draw (0,0) -- (1,0);` (quên `;` → lỗi compile) |
| **Backslash đơn** trong mã nguồn | `\draw`, không phải `\\draw` |
| **Không gửi `\documentclass`** | Gửi → lỗi compile |
| **Không gửi `\usepackage`** | Thư viện đã có sẵn (xem bên dưới) |

---

## Thư viện TikZ có sẵn

Blog tự nạp các thư viện sau, **KHÔNG cần `\usetikzlibrary`**:

| Thư viện | Dùng cho |
|----------|----------|
| `arrows.meta` | Mũi tên đẹp: `-Stealth`, `-Latex`, `-To` |
| `calc` | Tính toán tọa độ: `$(A)!0.5!(B)$` (trung điểm) |
| `decorations.pathreplacing` | Ngoặc nhọn đánh dấu đoạn |
| `positioning` | Định vị tương đối: `right=of A`, `below=2cm of B` |
| `shapes.geometric` | Hình tròn, elip, đa giác |

Nếu cần thư viện khác (vd `angles`, `intersections`, `patterns`, `pgfplots`)
→ báo quản trị viên thêm vào `render-service/app.js`.

---

## Ví dụ mẫu (đã verify render đúng hình)

Tất cả ví dụ dưới đây đã được test với render service — render ra SVG có hình
vẽ thật (đường nét, tô màu), không phải chỉ text.

### 1. Tam giác vuông có nhãn và dấu góc vuông

````markdown
```tikz
\begin{tikzpicture}[thick]
  \fill[blue!15] (0,0) -- (4,0) -- (0,3) -- cycle;
  \draw (0,0) -- (4,0) -- (0,3) -- cycle;
  \draw (0.3,0) -- (0.3,0.3) -- (0,0.3);
  \node[below left]  at (0,0) {$A$};
  \node[below right] at (4,0) {$B$};
  \node[above left]  at (0,3) {$C$};
  \node[below]       at (2,0) {$b$};
  \node[left]        at (0,1.5) {$a$};
  \node[above right] at (2,1.5) {$c$};
\end{tikzpicture}
```
````

### 2. Đường tròn đơn vị + góc θ

````markdown
```tikz
\begin{tikzpicture}[thick, scale=1.8]
  \fill[blue!10] (0,0) -- (0.866,0.5) arc (30:0:1) -- cycle;
  \draw (0,0) circle (1);
  \draw[->] (0,0) -- (1,0);
  \draw[->] (0,0) -- (0.866,0.5);
  \draw (0.2,0) arc (0:30:0.2);
  \node at (0.4,0.08) {$\theta$};
  \node[below] at (0.5,0) {$1$};
\end{tikzpicture}
```
````

### 3. Đồ thị hàm số y = x²

````markdown
```tikz
\begin{tikzpicture}[thick, scale=0.8]
  \draw[->] (-2.7,0) -- (2.7,0) node[right] {$x$};
  \draw[->] (0,-0.5) -- (0,4.3) node[above] {$y$};
  \foreach \x in {-2,-1,1,2} \draw (\x,0.1) -- (\x,-0.1) node[below] {$\x$};
  \foreach \y in {1,2,3} \draw (0.1,\y) -- (-0.1,\y) node[left] {$\y$};
  \draw[domain=-2:2, smooth, samples=40] plot (\x, {\x*\x});
  \node at (1.7,3.7) {$y = x^2$};
\end{tikzpicture}
```
````

### 4. Sơ đồ luồng (flowchart, nhãn tiếng Việt OK)

````markdown
```tikz
\begin{tikzpicture}[
  thick,
  box/.style={draw, rounded corners, minimum width=2.5cm, minimum height=1cm, fill=blue!8},
  arr/.style={-Stealth, thick}
]
  \node[box] (input) {Đầu vào $x$};
  \node[box, right=1.5cm of input] (process) {Tính $f(x)$};
  \node[box, right=1.5cm of process] (output) {Kết quả $y$};
  \draw[arr] (input) -- (process);
  \draw[arr] (process) -- (output);
\end{tikzpicture}
```
````

### 5. Tam giác có đo góc + nhãn cạnh

````markdown
```tikz
\begin{tikzpicture}[thick]
  \coordinate (A) at (0,0);
  \coordinate (B) at (5,0);
  \coordinate (C) at (2,3.5);
  \draw (A) -- (B) -- (C) -- cycle;
  \node[below left]  at (A) {$A$};
  \node[below right] at (B) {$B$};
  \node[above]       at (C) {$C$};
  \draw (0.6,0) arc (0:60:0.6);
  \node at (0.9,0.25) {$\alpha$};
\end{tikzpicture}
```
````

---

## Bảng tham chiếu nhanh (cheat sheet)

### Lệnh vẽ

| Lệnh | Tác dụng | Ví dụ |
|------|----------|-------|
| `\draw` | Vẽ đường thẳng/đường cong | `\draw (0,0) -- (3,2);` |
| `\fill` | Tô vùng khép kín | `\fill[red!30] (0,0) -- (1,0) -- (1,1) -- cycle;` |
| `\filldraw` | Vẽ + tô cùng lúc | `\filldraw[fill=blue!20] (0,0) circle (1);` |
| `\node` | Đặt text tại tọa độ | `\node at (2,0) {chào};` |
| `\node[...]` | Text có style | `\node[below, red] at (2,0) {...};` |
| `\coordinate` | Đặt tên tọa độ | `\coordinate (A) at (0,0);` |
| `\foreach` | Lặp (dùng cho ticks) | `\foreach \x in {1,2,3} \draw (\x,0) -- (\x,0.1);` |

### Hình cơ bản

| Lệnh | Hình | Ví dụ |
|------|------|-------|
| `circle (r)` | Hình tròn | `\draw (0,0) circle (2);` |
| `rectangle` | Hình chữ nhật | `\draw (0,0) rectangle (3,2);` |
| `arc (...)` | Cung tròn | `\draw (1,0) arc (0:90:1);` |
| `-- cycle` | Khép kín đường | `(0,0) -- (2,0) -- (1,1) -- cycle` |
| `plot (...)` | Đồ thị hàm | `\draw plot (\x, {\x*\x});` |

### Tùy chọn (trong `[...]`)

| Tùy chọn | Tác dụng |
|----------|----------|
| `thick`, `very thick`, `ultra thick` | Độ dày nét |
| `blue`, `red!30` | Màu (tên hoặc pha %) |
| `scale=2` | Phóng to toàn bộ |
| `dashed`, `dotted` | Nét đứt/chấm |
| `fill=blue!20` | Màu tô |
| `->`, `<-`, `<->` | Đầu mũi tên |
| `-Stealth` | Mũi tên đẹp (cần arrows.meta) |
| `rounded corners` | Bo góc |
| `minimum width=2cm` | Chiều rộng tối thiểu (node) |

### Nhãn toán học (KaTeX)

Dùng `$...$` trong `\node`:
- `$A$`, `$B$`, `$\theta$`, `$\alpha$`, `$\beta$`
- `$x^2$`, `$\frac{a}{b}$`, `$\sqrt{2}$`
- `$f(x) = \sin(x)$`

---

## Quy trình tạo bài có hình (cho Agent)

### Cách 1: Dùng helper script (khuyến nghị)

Helper script đọc body từ **file** → backslash sống sót 100% (không bị shell
escape). Đây là cách an toàn nhất.

```bash
# 1. Lưu nội dung bài vào file (vd article.md)
#    Viết \draw bình thường (backslash đơn)

# 2. Tạo bài qua helper
node ~/.agents/skills/maths-blog-publisher/scripts/publish.mjs create \
  --title "Định lý Pythagoras" \
  --file article.md \
  --slug pythagoras \
  --category "Geometry" \
  --tags "geometry,pythagoras" \
  --publish
```

### Cách 2: Gọi API trực tiếp (Python)

```python
import requests

BASE = "https://maths-blog.vercel.app"
KEY = "91d14d526d70bca8e4cd41ad811d68adf551abf8148128974b931242b7642fbe"
HEADERS = {"Authorization": f"Bearer {KEY}"}

# Mã TikZ — dùng raw string (r"..."), backslash đơn giữ nguyên
# json= sẽ tự escape \ thành \\ khi gửi
tikz = r"""
\begin{tikzpicture}[thick]
  \fill[blue!15] (0,0) -- (4,0) -- (0,3) -- cycle;
  \draw (0,0) -- (4,0) -- (0,3) -- cycle;
  \node[below left] at (0,0) {$A$};
  \node[below right] at (4,0) {$B$};
  \node[above left] at (0,3) {$C$};
\end{tikzpicture}
""".strip()

body_markdown = f"""## Định lý Pythagoras

```tikz
{tikz}
```

Khi đó $a^2 + b^2 = c^2$."""

resp = requests.post(
    f"{BASE}/api/agent/posts",
    headers=HEADERS,
    json={
        "title": "Định lý Pythagoras",
        "slug": "pythagoras",
        "bodyMarkdown": body_markdown,
        "category": "Geometry",
        "tags": ["geometry", "pythagoras"],
        "status": "published",
    },
)
print(resp.status_code, resp.json().get("post", {}).get("id"))
```

> **Quan trọng:** dùng `json=` (không phải `data=`) và raw string `r"..."`.
> KHÔNG tự thêm `\\` — `json=` tự escape.

### Cách 3: Gọi API trực tiếp (Node.js)

```javascript
const tikz = String.raw`
\begin{tikzpicture}[thick]
  \draw (0,0) -- (4,0) -- (0,3) -- cycle;
  \node[below left] at (0,0) {$A$};
\end{tikzpicture}
`.trim();

const bodyMarkdown = `## Định lý\n\n\`\`\`tikz\n${tikz}\n\`\`\`\n\n$a^2+b^2=c^2$.`;

const resp = await fetch(`${BASE}/api/agent/posts`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Định lý Pythagoras",
    bodyMarkdown,
    status: "published",
  }),
});
```

> **Quan trọng:** dùng `String.raw` để giữ backslash đơn, rồi `JSON.stringify`
> tự escape khi gửi.

---

## Lỗi thường gặp + cách sửa

| Triệu chứng | Nguyên nhân | Cách sửa |
|-------------|-------------|----------|
| Hình trống / chỉ 1-2 ký tự | Backslash bị escape kép (`\\draw` trong mã nguồn) | Dùng raw string + `json=`/`JSON.stringify` (không tự thêm `\\`) |
| Console: `Missing svg element` | Mã TikZ không hợp lệ | Kiểm tra `;` cuối mỗi lệnh, `\begin`/`\end` khớp |
| Hình vỡ: chữ chồng lên nhau | (đã sửa) render service cũ bỏ drawing specials | Đã fix; đảm bảo cache được re-populate |
| Lỗi 500 khi lưu bài | Mã TikZ lỗi cú pháp → compile fail | Bài vẫn lưu thành công; sửa mã rồi lưu lại |
| Hình cũ không update | Cache theo hash nội dung | Đổi nội dung TikZ (dù 1 ký tự) → hash đổi → render lại |
| "Diagram unavailable" | Render service đang cold-start (Render free tier) | Reload trang sau vài giây, hoặc chạy `populate-tikz-cache.mjs` |

### Kiểm tra mã TikZ trước khi gửi

Paste mã vào [Overleaf](https://overleaf.com) với wrapper:
```latex
\documentclass{standalone}
\usepackage{tikz}
\usetikzlibrary{arrows.meta,calc,decorations.pathreplacing,positioning,shapes.geometric}
\begin{document}
% paste mã của bạn ở đây
\end{document}
```
Nếu compile được ở Overleaf → sẽ render được trên blog.

---

## Giới hạn hiện tại

1. **Chỉ gửi phần thân** `\begin{tikzpicture}...\end{tikzpicture}`
2. **Không gửi** `\documentclass`, `\usepackage`, `\begin{document}`
3. **Thư viện cố định**: arrows.meta, calc, decorations.pathreplacing,
   positioning, shapes.geometric. Cần thêm → báo quản trị viên
4. **Không có** pgfplots, tikz-cd, circuitikz (trừ khi thêm vào service)
5. **Render mất 3-8 giây/diagram** (LaTeX compile thật). Lưu bài nhiều hình sẽ chậm
6. **Render service cold-start**: Render.com free tier ngủ sau 15 phút không dùng.
   Lần render đầu sau ngủ ~30 giây. SVG đã cache trong DB không bị ảnh hưởng

---

## Checklist trước khi gửi bài có hình

- [ ] Mã TikZ chỉ chứa phần thân (có `\begin{tikzpicture}` + `\end{tikzpicture}`)
- [ ] Không có `\documentclass`, `\usepackage`, `\begin{document}`
- [ ] Mọi lệnh kết thúc bằng `;` (`\draw ...;`, `\node ...;`, `\fill ...;`)
- [ ] Trong `bodyMarkdown` (string nguồn): backslash **ĐƠN** (`\draw`, không `\\draw`)
- [ ] Gửi qua `json=` (Python) / `JSON.stringify` (Node) / `--data @file` (curl)
- [ ] Không tự nhân đôi backslash thủ công
- [ ] Test: tạo 1 bài draft trước, xem có lỗi compile không, rồi mới publish
