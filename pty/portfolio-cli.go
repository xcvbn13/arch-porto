// Command portfolio di dalam shell Arch (read-only).
// Binary tunggal tanpa interpreter: /opt/bin/<nama> → symlink ke binary ini,
// subcommand = basename argv[0]. HTTP hanya ke backend internal (URL tetap).
// 'config-admin' TERSEMBUNYI (tidak tercantum di 'help').
package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

const base = "http://backend:8080/api/v1"

var (
	green  = "\x1b[32m"
	cyan   = "\x1b[36m"
	dim    = "\x1b[2m"
	red    = "\x1b[31m"
	yellow = "\x1b[33m"
	bold   = "\x1b[1m"
	rst    = "\x1b[0m"
)

var ansiRe = regexp.MustCompile(`\x1b\[[0-9;?]*[ -/]*[@-~]`)

func clean(s string) string { return ansiRe.ReplaceAllString(s, "") }

func cmd() string { return filepath.Base(os.Args[0]) }

func args() []string { return os.Args[1:] }

// httpGet/httpPost mengembalikan data apa adanya: objek ATAU array —
// endpoint profil berbentuk objek, endpoint daftar berbentuk array.
func httpGet(path string) (interface{}, error) {
	client := &http.Client{Timeout: 8 * time.Second}
	req, _ := http.NewRequest("GET", base+path, nil)
	req.Header.Set("Accept", "application/json")
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d", res.StatusCode)
	}
	var env struct {
		Data interface{} `json:"data"`
	}
	json.Unmarshal(body, &env)
	return env.Data, nil
}

func httpPost(path string, payload map[string]string) (interface{}, error) {
	client := &http.Client{Timeout: 8 * time.Second}
	buf, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", base+path, bytes.NewReader(buf))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d", res.StatusCode)
	}
	var env struct {
		Data interface{} `json:"data"`
	}
	json.Unmarshal(body, &env)
	return env.Data, nil
}

func asMap(v interface{}) (map[string]interface{}, bool) {
	m, ok := v.(map[string]interface{})
	return m, ok
}

func asRows(v interface{}) []interface{} {
	r, _ := v.([]interface{})
	return r
}

func s(v interface{}) string {
	if v == nil {
		return ""
	}
	if str, ok := v.(string); ok {
		return clean(str)
	}
	if f, ok := v.(float64); ok {
		return strconv.FormatFloat(f, 'f', -1, 64)
	}
	return clean(fmt.Sprint(v))
}

func errOut(msg string) { fmt.Printf("%s%s%s\n", red, msg, rst) }
func note(msg string)   { fmt.Printf("%s%s%s\n", dim, msg, rst) }

func osc8(u, text string) string {
	return "\x1b]8;;" + u + "\x1b\\" + text + "\x1b]8;;\x1b\\"
}

// linkify: bungkus URL http(s) dengan hyperlink OSC 8 (Ctrl+Klik = tab baru).
func linkify(v string) string {
	u := strings.TrimSpace(v)
	if strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://") {
		return osc8(u, u)
	}
	return u
}

// displayLink: nilai kolom → teks; email menjadi mailto:, URL menjadi OSC 8.
func displayLink(kind, val string) string {
	if val == "" || val == "-" {
		return val
	}
	if kind == "Email" && strings.Contains(val, "@") {
		return osc8("mailto:"+val, val)
	}
	return linkify(val)
}

func wrap(text string, width int) []string {
	var out []string
	for _, raw := range strings.Split(text, "\n") {
		if len(raw) <= width {
			out = append(out, raw)
			continue
		}
		rest := strings.TrimSpace(raw)
		for len(rest) > width {
			cut := strings.LastIndex(rest[:width], " ")
			if cut < width/2 {
				cut = width
			}
			out = append(out, strings.TrimRight(rest[:cut], " "))
			rest = strings.TrimLeft(rest[cut:], " ")
		}
		if rest != "" {
			out = append(out, rest)
		}
	}
	return out
}

func readPassword(prompt string) (string, error) {
	fmt.Print(prompt)
	fd := int(os.Stdin.Fd())
	var old syscall.Termios
	_, _, _ = syscall.Syscall6(syscall.SYS_IOCTL, uintptr(fd), uintptr(syscall.TCGETS), uintptr(unsafe.Pointer(&old)), 0, 0, 0)
	noEcho := old
	noEcho.Lflag &^= syscall.ECHO
	_, _, _ = syscall.Syscall6(syscall.SYS_IOCTL, uintptr(fd), uintptr(syscall.TCSETS), uintptr(unsafe.Pointer(&noEcho)), 0, 0, 0)
	defer syscall.Syscall6(syscall.SYS_IOCTL, uintptr(fd), uintptr(syscall.TCSETS), uintptr(unsafe.Pointer(&old)), 0, 0, 0)
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	fmt.Println()
	if err != nil {
		return "", err
	}
	return strings.TrimRight(line, "\r\n"), nil
}

// printProjectDetail mencetak detail satu proyek (dipakai `projects`,
// `projects show <id>`, dan `show all`). Header memuat ID agar bisa
// ditindaklanjuti dengan `projects show <id>`.
func printProjectDetail(d map[string]interface{}) {
	fmt.Printf("%s#%s%s %s%s%s%s", dim, s(d["id"]), rst, bold, green, s(d["title"]), rst)
	if s(d["year"]) != "" {
		fmt.Printf(" (%s)", s(d["year"]))
	}
	fmt.Println()
	fmt.Println(dim + strings.Repeat("─", 40) + rst)
	for _, kv := range [][2]string{
		{"Project Affiliation", "summary"},
		{"Description", "description"},
		{"Problem solved", "problem"},
		{"My contribution", "contribution"},
		{"Architecture", "architecture"},
	} {
		if s(d[kv[1]]) != "" {
			fmt.Printf("%s%s%s\n", cyan, kv[0], rst)
			for _, l := range wrap(s(d[kv[1]]), 80) {
				fmt.Println("  " + l)
			}
		}
	}
	if st, ok := d["stack"].([]interface{}); ok && len(st) > 0 {
		fmt.Printf("%sTech stack%s\n", cyan, rst)
		var names []string
		for _, x := range st {
			names = append(names, s(x))
		}
		fmt.Println("  " + strings.Join(names, ", "))
	}
	for _, kv := range [][2]string{{"Repository", "repo_url"}, {"Demo", "demo_url"}} {
		if s(d[kv[1]]) != "" {
			fmt.Printf("%s%s%s  %s\n", cyan, kv[0], rst, linkify(s(d[kv[1]])))
		}
	}
	if m, ok := d["metrics"].(map[string]interface{}); ok && len(m) > 0 {
		fmt.Printf("%sMeasured results%s\n", cyan, rst)
		for k, v := range m {
			fmt.Printf("  %s: %s\n", k, s(v))
		}
	}
}

func hAbout(a []string) {
	if len(a) > 0 {
		errOut("about: no arguments needed.")
		return
	}
	data, err := httpGet("/profile")
	if err != nil {
		errOut("Backend tidak terjangkau.")
		return
	}
	d, ok := asMap(data)
	if !ok {
		errOut("Terjadi kesalahan saat memproses data.")
		return
	}
	// Teks dibungkus marker: frontend mendeteksinya dan mengganti blok ini
	// dengan satu canvas (foto kiri + teks kanan). Klien teks murni melihat
	// teks biasa (marker OSC tidak tampil).
	fmt.Print("\x1b]1337;Portfolio=about-start\x07")
	fmt.Printf("%s%s%s%s\n", bold, green, s(d["name"]), rst)
	fmt.Printf("%s%s%s\n", cyan, s(d["role"]), rst)
	if s(d["tagline"]) != "" {
		fmt.Printf("%s%s%s\n", dim, s(d["tagline"]), rst)
	}
	fmt.Println()
	for _, l := range wrap(s(d["bio"]), 80) {
		fmt.Println(l)
	}
	fmt.Print("\x1b]1337;Portfolio=about-end\x07")
}

func hSkills(a []string) {
	data, err := httpGet("/skills")
	if err != nil {
		errOut("Backend tidak terjangkau.")
		return
	}
	rows := asRows(data)
	if len(rows) == 0 {
		note("Belum ada data.")
		return
	}
	grouped := map[string][]string{}
	for _, r := range rows {
		m, _ := r.(map[string]interface{})
		grouped[s(m["category"])] = append(grouped[s(m["category"])], s(m["name"]))
	}
	filt := ""
	if len(a) > 0 {
		filt = strings.ToLower(a[0])
		found := false
		for k := range grouped {
			if strings.ToLower(k) == filt {
				found = true
			}
		}
		if !found {
			errOut(fmt.Sprintf("Kategori '%s' tidak dikenal.", a[0]))
			return
		}
	}
	keys := make([]string, 0, len(grouped))
	for k := range grouped {
		keys = append(keys, k)
	}
	for i := 0; i < len(keys); i++ {
		for j := i + 1; j < len(keys); j++ {
			if keys[j] < keys[i] {
				keys[i], keys[j] = keys[j], keys[i]
			}
		}
	}
	for _, cat := range keys {
		if filt != "" && strings.ToLower(cat) != filt {
			continue
		}
		fmt.Printf("%s%s%s:\n", cyan, cat, rst)
		fmt.Println("  " + strings.Join(grouped[cat], ", "))
	}
}

func hProjects(a []string) {
	if len(a) > 0 && a[0] == "show" {
		if len(a) != 2 {
			errOut("usage: projects show <id>  (lihat ID lewat 'projects')")
			return
		}
		if _, e := strconv.Atoi(a[1]); e != nil {
			errOut("usage: projects show <id>")
			return
		}
		data, err := httpGet("/projects/" + url.PathEscape(a[1]))
		if err != nil {
			errOut("Proyek tidak ditemukan.")
			return
		}
		d, ok := asMap(data)
		if !ok {
			errOut("Terjadi kesalahan saat memproses data.")
			return
		}
		// Marker: frontend mengganti blok ini dengan canvas 2 bagian
		// (gambar screenshot kiri + detail teks kanan).
		fmt.Printf("\x1b]1337;Portfolio=project-start:%s\x07", a[1])
		printProjectDetail(d)
		fmt.Print("\x1b]1337;Portfolio=project-end\x07")
		return
	}
	if len(a) > 1 || (len(a) == 1 && a[0] != "list") {
		errOut("usage: projects [show <id>]")
		return
	}
	data, err := httpGet("/projects?page=1&per_page=50")
	if err != nil {
		errOut("Backend tidak terjangkau.")
		return
	}
	rows := asRows(data)
	if len(rows) == 0 {
		note("Belum ada data.")
		return
	}
	// Detail lengkap semua proyek; tiap proyek dibungkus marker sehingga
	// frontend merender satu canvas 2 bagian per proyek (screenshot kiri,
	// detail kanan). Klien teks murni melihat teks detailnya saja.
	for i, r := range rows {
		m, _ := r.(map[string]interface{})
		if i > 0 {
			fmt.Println()
		}
		fmt.Printf("\x1b]1337;Portfolio=project-start:%s\x07", s(m["id"]))
		printProjectDetail(m)
		fmt.Print("\x1b]1337;Portfolio=project-end\x07")
	}
	note("Detail spesifik: projects show <id>")
}

func hSimpleList(kind string, title string, key string) {
	data, err := httpGet("/" + kind)
	if err != nil {
		errOut("Backend tidak terjangkau.")
		return
	}
	rows := asRows(data)
	if len(rows) == 0 {
		note("Belum ada data.")
		return
	}
	for _, r := range rows {
		m, _ := r.(map[string]interface{})
		fmt.Printf("%s%s%s\n", bold, s(m[key]), rst)
		extra := ""
		if kind == "education" {
			extra = s(m["field"])
			if s(m["period_start"]) != "" {
				if extra != "" {
					extra += " · "
				}
				extra += s(m["period_start"])
			}
		} else if kind == "experience" {
			extra = s(m["company"])
			if s(m["period_start"]) != "" {
				extra += "  " + s(m["period_start"]) + " — " + s(m["period_end"])
				if s(m["period_end"]) == "" {
					extra += "present"
				}
			}
		} else if kind == "certifications" {
			extra = s(m["issuer"])
			if s(m["year"]) != "" {
				extra += "  " + s(m["year"])
			}
		} else if kind == "publications" {
			extra = s(m["venue"])
			if s(m["year"]) != "" {
				extra += "  " + s(m["year"])
			}
		}
		if extra != "" {
			fmt.Printf("%s%s%s\n", cyan, extra, rst)
		}
		if s(m["summary"]) != "" {
			for _, l := range wrap(s(m["summary"]), 80) {
				fmt.Println("  " + l)
			}
		}
		if kind == "experience" {
			if hl, ok := m["highlights"].([]interface{}); ok {
				for _, h := range hl {
					fmt.Printf("  %s•%s %s\n", green, rst, s(h))
				}
			}
		}
		if kind == "certifications" {
			if s(m["credential_url"]) != "" {
				fmt.Println("  " + linkify(s(m["credential_url"])))
			}
			if s(m["file_url"]) != "" {
				fmt.Printf("  File: %s\n", linkify(s(m["file_url"])))
			}
		}
		if kind == "publications" && s(m["url"]) != "" {
			fmt.Println("  " + linkify(s(m["url"])))
		}
		fmt.Println()
	}
}

func hContact(a []string) {
	if len(a) > 0 && a[0] == "send" {
		rest := a[1:]
		if len(rest) < 3 {
			errOut("usage: contact send \"Nama\" \"email@x\" \"pesan...\"")
			return
		}
		_, err := httpPost("/contact", map[string]string{
			"name": rest[0], "email": rest[1], "message": strings.Join(rest[2:], " "),
		})
		if err != nil {
			code := err.Error()
			if strings.Contains(code, "422") {
				errOut("Validasi gagal — periksa nama/email/pesan.")
			} else if strings.Contains(code, "429") {
				errOut("Terlalu sering — tunggu sebentar.")
			} else {
				errOut("Gagal mengirim (" + code + ").")
			}
			return
		}
		fmt.Printf("%sPesan terkirim — pemilik membacanya dari database.%s\n", green, rst)
		return
	}
	if len(a) > 0 {
		errOut("usage: contact | contact send \"Nama\" \"email\" \"pesan\"")
		return
	}
	data, err := httpGet("/profile")
	if err != nil {
		errOut("Backend tidak terjangkau.")
		return
	}
	d, ok := asMap(data)
	if !ok {
		errOut("Terjadi kesalahan saat memproses data.")
		return
	}
	for _, kv := range [][2]string{{"Email", "email"}, {"GitHub", "github_url"}, {"LinkedIn", "linkedin_url"}, {"Website", "website_url"}} {
		val := s(d[kv[1]])
		if val == "" {
			val = "-"
		}
		fmt.Printf("%s%-9s%s %s\n", cyan, kv[0], rst, displayLink(kv[0], val))
	}
	note("Kirim pesan: contact send \"Nama\" \"email\" \"pesan\"")
}

func hGithub(a []string) {
	data, err := httpGet("/profile")
	if err != nil {
		errOut("Backend tidak terjangkau.")
		return
	}
	d, ok := asMap(data)
	if !ok {
		errOut("Terjadi kesalahan saat memproses data.")
		return
	}
	u := s(d["github_url"])
	if u == "" {
		errOut("GitHub belum dikonfigurasi (config-admin → Profile).")
		return
	}
	fmt.Println(osc8(u, bold+"→ "+u+rst))
}

// show all → tampilkan keseluruhan profil sekaligus.
func hShow(a []string) {
	if len(a) > 1 || (len(a) == 1 && a[0] != "all") {
		errOut("usage: show all")
		return
	}
	section := func(t string) {
		bar := strings.Repeat("─", 16)
		fmt.Printf("\n%s %s %s %s\n", dim, bar, bold+cyan+strings.ToUpper(t)+rst, dim+bar+rst)
	}
	section("about")
	hAbout(nil)
	section("experience")
	hSimpleList("experience", "", "role")
	section("education")
	hSimpleList("education", "", "degree")
	section("skills")
	hSkills(nil)
	section("publications")
	hSimpleList("publications", "", "title")
	section("certifications")
	hSimpleList("certifications", "", "name")
	section("projects")
	hProjects(nil)
	section("socials")
	hSocials(nil)
}

func hSocials(a []string) {
	data, err := httpGet("/profile")
	if err != nil {
		errOut("Backend tidak terjangkau.")
		return
	}
	d, ok := asMap(data)
	if !ok {
		errOut("Terjadi kesalahan saat memproses data.")
		return
	}
	for _, kv := range [][2]string{{"GitHub", "github_url"}, {"LinkedIn", "linkedin_url"}, {"Website", "website_url"}, {"Email", "email"}} {
		val := s(d[kv[1]])
		if val == "" {
			val = "-"
		}
		fmt.Printf("%s%-9s%s %s\n", cyan, kv[0], rst, displayLink(kv[0], val))
	}
}

const helpText = `Available commands (read-only shell Arch):

  portfolio
    show all                     Everything at a glance
    about                        Professional introduction
    experience                   Professional experience
    education                    Education history
    skills [category]            Technical skills by category
    publications                 Publications
    certifications               Certifications
    socials                      Social links
    projects [show <id>]         Featured projects
    contact [send ...]           Contact info / send message
    github                       Open GitHub profile

  arch (binary asli)
    ls cat pwd whoami uname fastfetch pacman grep head wc echo date sort tr clear

  exit                          kembali ke halaman awal
`

func hHelp(a []string) { fmt.Print(helpText) }

// clear → penanda ke frontend: frontend yang merender ulang welcome (canvas),
// sehingga tampilan persis sama dengan saat refresh.
func hClear(a []string) {
	fmt.Print("\x1b[2J\x1b[H\x1b]1337;Portfolio=welcome\x07")
}

func hConfigAdmin(a []string) {
	pw, err := readPassword("[sudo] password for visitor: ")
	if err != nil || pw == "" {
		if err == nil {
			errOut("Password kosong — dibatalkan.")
		}
		return
	}
	data, err := httpPost("/admin/login", map[string]string{"password": pw})
	if err != nil {
		code := err.Error()
		if strings.Contains(code, "401") {
			errOut("Sorry, try again.")
		} else if strings.Contains(code, "423") {
			errOut("Locked: terlalu banyak percobaan — coba 15 menit lagi.")
		} else if strings.Contains(code, "429") {
			errOut("Terlalu sering — tunggu sebentar.")
		} else {
			errOut("Login gagal (" + code + ").")
		}
		return
	}
	d, ok := asMap(data)
	if !ok {
		errOut("Terjadi kesalahan saat memproses data.")
		return
	}
	fmt.Printf("%sLogin berhasil sebagai %s.%s\n", green, s(d["email"]), rst)
	fmt.Println()
	fmt.Println("Klik tautan ini untuk membuka panel admin:")
	fmt.Println(osc8(s(d["enter_url"]), bold+green+"→ buka /admin"+rst))
	fmt.Printf("%s%s%s\n", dim, s(d["enter_url"]), rst)
	note("Tautan berlaku 60 detik dan hanya sekali pakai.")
}

func main() {
	switch cmd() {
	case "about":
		hAbout(args())
	case "skills":
		hSkills(args())
	case "projects":
		hProjects(args())
	case "experience":
		hSimpleList("experience", "pengalaman", "role")
	case "education":
		hSimpleList("education", "pendidikan", "degree")
	case "certifications":
		hSimpleList("certifications", "sertifikasi", "name")
	case "publications":
		hSimpleList("publications", "publikasi", "title")
	case "contact":
		hContact(args())
	case "github":
		hGithub(args())
	case "socials":
		hSocials(args())
	case "show":
		hShow(args())
	case "help":
		hHelp(args())
	case "clear":
		hClear(args())
	case "config-admin":
		hConfigAdmin(args())
	default:
		errOut(fmt.Sprintf("%s: command not found — ketik 'help' untuk daftar command.", cmd()))
		os.Exit(127)
	}
}
