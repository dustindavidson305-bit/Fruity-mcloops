#!/usr/bin/env python3
"""Manual APK builder for Fruity McLoops.

Adapted from the Ash & Iron manual pipeline (same proven phases:
aapt2 compile/link, javac, d8, zipalign, apksigner) minus the
Capacitor/Maven dependency machinery — this app is a plain WebView
with a single MainActivity and no external libraries, so it links
against android.jar alone. Gradle is not used (its daemon IPC is
broken in this sandbox).
"""
import os, subprocess, sys, shutil, zipfile

HOME = os.path.expanduser("~")
# Repo root = parent of this script's manual-build/ directory, so the
# build works wherever the repo is cloned out.
APP_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANDROID = f"{APP_ROOT}/manual-build/android"
SDK = (os.environ.get("ANDROID_SDK_ROOT") or os.environ.get("ANDROID_HOME")
       or f"{HOME}/android-sdk")
BT = f"{SDK}/build-tools/35.0.0"
ANDROID_JAR = f"{SDK}/platforms/android-35/android.jar"
BUILD = f"{APP_ROOT}/manual-build"
APP_ID = "com.delukz.fruitymcloops"
MIN_SDK = "24"
TARGET_SDK = "35"
VERSION_CODE = "3"
VERSION_NAME = "2.1"

ENV = dict(os.environ)
_jdk_candidates = []
if os.environ.get("JAVA_HOME"):
    _jdk_candidates.append(os.environ["JAVA_HOME"])
_jdk_candidates += [f"{HOME}/jdk21", f"{HOME}/jdk17"]
_sys_javac = shutil.which("javac")
if _sys_javac:
    _jdk_candidates.append(os.path.dirname(os.path.dirname(os.path.realpath(_sys_javac))))
for jdk in _jdk_candidates:
    if os.path.exists(f"{jdk}/bin/javac"):
        ENV["JAVA_HOME"] = jdk
        ENV["PATH"] = f"{jdk}/bin:" + ENV["PATH"]
        break
else:
    sys.exit("FATAL: no JDK found")

def run(cmd, **kw):
    print("+", " ".join(cmd[:4]), "..." if len(cmd) > 4 else "", flush=True)
    r = subprocess.run(cmd, env=ENV, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        print(r.stdout[-3000:]); print(r.stderr[-3000:])
        sys.exit(f"FATAL: {' '.join(cmd[:3])} failed (rc={r.returncode})")
    return r

def stage_assets():
    """Copy the single-file web app into the Android assets folder."""
    src = f"{APP_ROOT}/app/index.html"
    dst_dir = f"{ANDROID}/app/src/main/assets/public"
    os.makedirs(dst_dir, exist_ok=True)
    dst = f"{dst_dir}/index.html"
    shutil.copy2(src, dst)
    print(f"staged {src} -> {dst} ({os.path.getsize(dst)} bytes)")
    return f"{ANDROID}/app/src/main/assets"

def aapt2():
    comp = f"{BUILD}/compiled"
    os.makedirs(comp, exist_ok=True)
    res_zip = f"{comp}/app.zip"
    run([f"{BT}/aapt2", "compile", "--dir", f"{ANDROID}/app/src/main/res",
         "-o", res_zip])
    gen = f"{BUILD}/gen"
    os.makedirs(gen, exist_ok=True)
    run([f"{BT}/aapt2", "link", "-o", f"{BUILD}/base.apk",
         "-I", ANDROID_JAR,
         "--manifest", f"{ANDROID}/app/src/main/AndroidManifest.xml",
         "--min-sdk-version", MIN_SDK, "--target-sdk-version", TARGET_SDK,
         "--version-code", VERSION_CODE, "--version-name", VERSION_NAME,
         "--java", gen, "--auto-add-overlay",
         "--output-text-symbols", f"{BUILD}/R.txt",
         "-A", stage_assets(),
         "-R", res_zip])

def javac():
    srcs = []
    for root, _, files in os.walk(f"{ANDROID}/app/src/main/java"):
        srcs += [os.path.join(root, f) for f in files if f.endswith(".java")]
    for root, _, files in os.walk(f"{BUILD}/gen"):
        srcs += [os.path.join(root, f) for f in files if f.endswith(".java")]
    if not srcs:
        sys.exit("FATAL: no Java sources found")
    out = f"{BUILD}/classes"
    os.makedirs(out, exist_ok=True)
    argfile = f"{BUILD}/sources.txt"
    with open(argfile, "w") as f:
        f.write("\n".join(f'"{s}"' for s in srcs))
    run([f"{ENV['JAVA_HOME']}/bin/javac", "-encoding", "UTF-8",
         "--release", "8", "-d", out, "-cp", ANDROID_JAR, f"@{argfile}"])
    print(f"compiled {len(srcs)} java files")

def dex():
    out = f"{BUILD}/dex"
    os.makedirs(out, exist_ok=True)
    app_jar = f"{BUILD}/app-classes.jar"
    run(["jar", "--create", "--file", app_jar, "-C", f"{BUILD}/classes", "."])
    run([f"{BT}/d8", "--min-api", MIN_SDK, "--lib", ANDROID_JAR,
         "--output", out, app_jar])

def package_apk():
    unsigned = f"{BUILD}/unsigned.apk"
    shutil.copy2(f"{BUILD}/base.apk", unsigned)
    dexs = sorted(f for f in os.listdir(f"{BUILD}/dex") if f.endswith(".dex"))
    if not dexs:
        sys.exit("FATAL: no dex files produced")
    with zipfile.ZipFile(unsigned, "a", zipfile.ZIP_DEFLATED) as z:
        for d in dexs:
            z.write(f"{BUILD}/dex/{d}", d)
    aligned = f"{BUILD}/aligned.apk"
    run([f"{BT}/zipalign", "-f", "4", unsigned, aligned])
    ks = f"{HOME}/.android/debug.keystore"
    if not os.path.exists(ks):
        os.makedirs(os.path.dirname(ks), exist_ok=True)
        run([f"{ENV['JAVA_HOME']}/bin/keytool", "-genkeypair",
             "-keystore", ks, "-storepass", "android", "-keypass", "android",
             "-alias", "androiddebugkey", "-keyalg", "RSA", "-keysize", "2048",
             "-validity", "10950",
             "-dname", "CN=Android Debug,O=Android,C=US"])
        print("NOTE: generated standard Android debug keystore at", ks)
    final = f"{BUILD}/fruity-mcloops.apk"
    run([f"{BT}/apksigner", "sign", "--ks", ks,
         "--ks-pass", "pass:android", "--key-pass", "pass:android",
         "--out", final, aligned])
    print("== verify ==")
    run([f"{BT}/apksigner", "verify", "--print-certs", final])
    r = run([f"{BT}/aapt", "dump", "badging", final])
    print(r.stdout[:1200])
    dst = f"{APP_ROOT}/fruity-mcloops.apk"
    shutil.copy2(final, dst)
    print(f"APK -> {dst} ({os.path.getsize(dst)} bytes)")

def main():
    for d in ("compiled", "gen", "classes", "dex"):
        os.makedirs(f"{BUILD}/{d}", exist_ok=True)
    for t in ("aapt2", "d8", "zipalign", "apksigner", "aapt"):
        if not os.path.exists(f"{BT}/{t}"):
            sys.exit(f"FATAL: missing {BT}/{t}")
    if not os.path.exists(ANDROID_JAR):
        sys.exit("FATAL: missing android.jar")
    print("== Phase 1: aapt2 compile/link ==")
    aapt2()
    print("== Phase 2: javac ==")
    javac()
    print("== Phase 3: d8 ==")
    dex()
    print("== Phase 4: package/sign ==")
    package_apk()
    print("DONE")

if __name__ == "__main__":
    main()
