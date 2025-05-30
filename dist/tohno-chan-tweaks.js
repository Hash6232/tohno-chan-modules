(function () {
    'use strict';

    var FileFormats;
    (function (FileFormats) {
        (function (Image) {
            Image["BMP"] = "image/bmp";
            Image["GIF"] = "image/gif";
            Image["JPG"] = "image/jpeg";
            Image["JPEG"] = "image/jpeg";
            Image["PNG"] = "image/png";
            Image["WEBP"] = "image/webp";
        })(FileFormats.Image || (FileFormats.Image = {}));
        (function (Video) {
            Video["FLV"] = "video/x-flv";
            Video["MP4"] = "video/mp4";
            Video["WEBM"] = "video/webm";
        })(FileFormats.Video || (FileFormats.Video = {}));
        (function (Audio) {
            Audio["FLAC"] = "audio/flac";
            Audio["MP3"] = "audio/mpeg";
        })(FileFormats.Audio || (FileFormats.Audio = {}));
    })(FileFormats || (FileFormats = {}));
    var Selectors;
    (function (Selectors) {
        (function (Form) {
            Form["POST"] = "form[name='post']";
            Form["POST_QR"] = "form[name='post']#quick-reply";
            Form["TEXTAREA"] = "textarea[name='body']";
            Form["INPUT_FILE"] = "input[name='file']";
            Form["SPOILER"] = "input[name='spoiler']";
            Form["CLOSE_QR"] = "a.close-btn";
        })(Selectors.Form || (Selectors.Form = {}));
        (function (Index) {
            Index["INDEX"] = "form[name='postcontrols']";
            Index["THREAD"] = ".thread";
            Index["POST"] = ".post";
        })(Selectors.Index || (Selectors.Index = {}));
    })(Selectors || (Selectors = {}));

    const Config = {
        allowed_ext: {
            image: [
                FileFormats.Image.BMP,
                FileFormats.Image.GIF,
                FileFormats.Image.JPG,
                FileFormats.Image.JPEG,
                FileFormats.Image.PNG,
            ],
            video: [FileFormats.Video.MP4, FileFormats.Video.WEBM],
            audio: [FileFormats.Audio.FLAC, FileFormats.Audio.MP3],
        },
        max_filesize: 10000};

    var DateUtils;
    (function (DateUtils) {
        const formatToRelative = (diffInSeconds) => {
            const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
            const delta = diffInSeconds > 0 ? -1 : 1;
            if (diffInSeconds < 60) {
                return rtf.format(diffInSeconds * delta, "second");
            }
            const diffInMinutes = Math.floor(diffInSeconds / 60);
            if (diffInMinutes < 60) {
                return rtf.format(diffInMinutes * delta, "minute");
            }
            const diffInHours = Math.floor(diffInMinutes / 60);
            if (diffInHours < 24) {
                return rtf.format(diffInHours * delta, "hour");
            }
            const diffInDays = Math.floor(diffInHours / 24);
            if (diffInDays < 30) {
                return rtf.format(diffInDays * delta, "day");
            }
            const diffInMonths = Math.floor(diffInDays / 30);
            if (diffInMonths < 12) {
                return rtf.format(diffInMonths * delta, "month");
            }
            const diffInYears = Math.floor(diffInDays / 365);
            return rtf.format(diffInYears * delta, "year");
        };
        DateUtils.toRelative = (date) => {
            const now = new Date();
            const past = new Date(date);
            const diff = Math.floor((now.getTime() - past.getTime()) / 1000);
            return formatToRelative(Math.abs(diff));
        };
    })(DateUtils || (DateUtils = {}));
    var DOMUtils;
    (function (DOMUtils) {
        DOMUtils.onContentLoaded = (callback, query) => {
            for (const node of [query].flat()) {
                if (node) {
                    callback();
                    return;
                }
            }
            document.addEventListener("DOMContentLoaded", () => callback());
        };
        DOMUtils.onElementLoaded = (callback, query, cleanup = false) => {
            if (document.body.querySelector(query)) {
                callback();
                return;
            }
            const observer = new MutationObserver((mutationsList, observerInstance) => {
                for (const mutation of mutationsList) {
                    for (const addedNode of mutation.addedNodes) {
                        if (addedNode.nodeType === 1 && addedNode.matches(query)) {
                            callback();
                            cleanup && observerInstance.disconnect();
                            return;
                        }
                    }
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        };
        DOMUtils.onElementVisible = (node, callback, options) => {
            const observer = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting)
                        return;
                    if (entry.target.nodeType !== 1)
                        return;
                    callback();
                    observer.unobserve(entry.target);
                });
            }, options ?? {
                root: null,
                rootMargin: "0px",
                threshold: 0.1,
            });
            observer.observe(node);
        };
    })(DOMUtils || (DOMUtils = {}));
    var FormUtils;
    (function (FormUtils) {
        FormUtils.setInputFile = (input, file) => {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            input.dispatchEvent(new Event("change", { bubbles: true }));
        };
    })(FormUtils || (FormUtils = {}));
    var StringUtils;
    (function (StringUtils) {
        StringUtils.templateHandler = (strings, ...values) => String.raw({ raw: strings }, ...values);
    })(StringUtils || (StringUtils = {}));
    var ValidationUtils;
    (function (ValidationUtils) {
        ValidationUtils.inputHasFile = (input) => {
            return input.files && input.files.length > 0;
        };
        ValidationUtils.fileIsAllowed = (file) => {
            return Object.values(Config.allowed_ext).some((type) => type.some((mime) => mime === file.type));
        };
        ValidationUtils.fileIsValidImage = (file, mimes = Config.allowed_ext.image) => {
            return mimes.some((mime) => mime === file.type);
        };
        ValidationUtils.fileIsValidVideo = (file, mimes = Config.allowed_ext.video) => {
            return mimes.some((mime) => mime === file.type);
        };
        ValidationUtils.fileIsValidAudio = (file, mimes = Config.allowed_ext.audio) => {
            return mimes.some((mime) => mime === file.type);
        };
        ValidationUtils.filesizeIsTooBig = (file, kilobytes) => {
            return file.size > (kilobytes ?? Config.max_filesize) * 1024;
        };
    })(ValidationUtils || (ValidationUtils = {}));

    const handlePasteEvent = async ({ clipboardData }, input) => {
        if (!clipboardData || clipboardData.files.length > 1)
            return;
        const file = clipboardData.files[0];
        if (!file)
            return;
        const options = { type: file.type, lastModified: file.lastModified };
        let originalFilename = file.name;
        for (const item of clipboardData.items) {
            if (item.type !== "text/html")
                continue;
            const html = await new Promise((resolve) => item.getAsString(resolve));
            const doc = new DOMParser().parseFromString(html, "text/html");
            const img = doc.querySelector("img");
            if (img && img.src) {
                const url = new URL(img.src);
                const pathname = url.pathname;
                const filename = pathname.substring(pathname.lastIndexOf("/") + 1);
                const extension = file.name.split(".").pop();
                originalFilename = filename + "." + extension;
            }
        }
        const output = new File([file], originalFilename, options);
        FormUtils.setInputFile(input, output);
    };
    const filePasteFeature = (form) => {
        const textarea = form.querySelector(Selectors.Form.TEXTAREA);
        const fileInput = form.querySelector(Selectors.Form.INPUT_FILE);
        if (!textarea || !fileInput)
            return;
        textarea.addEventListener("paste", (e) => handlePasteEvent(e, fileInput));
    };

    const handleFileInputChange = ({ currentTarget }, fileName) => {
        const fileInput = currentTarget;
        if (!fileInput)
            return;
        const file = fileInput.files?.[0];
        fileName.value = file ? file.name : "";
    };
    const handleFileInputCancel = (fileName) => {
        fileName.blur();
    };
    const handleFileNameClick = (fileInput) => {
        if (ValidationUtils.inputHasFile(fileInput))
            return;
        fileInput.click();
    };
    const handleFileNameBlur = ({ currentTarget }, fileInput) => {
        const fileName = currentTarget;
        if (!fileName || !ValidationUtils.inputHasFile(fileInput))
            return;
        const file = fileInput.files[0];
        if (!file)
            return;
        const options = { type: file.type, lastModified: file.lastModified };
        const updatedFile = new File([file], fileName.value, options);
        FormUtils.setInputFile(fileInput, updatedFile);
    };
    const fileRenameFeature = (form) => {
        const fileInput = form.querySelector(Selectors.Form.INPUT_FILE);
        if (!fileInput)
            return;
        form.querySelector(".upload-filename")?.remove();
        const fileName = document.createElement("input");
        fileName.placeholder = "Click to upload a file..";
        fileName.className = "upload-filename";
        fileName.type = "text";
        fileInput.insertAdjacentElement("afterend", fileName);
        fileInput.addEventListener("change", (e) => handleFileInputChange(e, fileName));
        fileInput.addEventListener("cancel", () => handleFileInputCancel(fileName));
        fileName.addEventListener("click", () => handleFileNameClick(fileInput));
        fileName.addEventListener("blur", (e) => handleFileNameBlur(e, fileInput));
    };

    var FileUtils;
    (function (FileUtils) {
        FileUtils.mimeToExt = (mimeInput) => {
            for (const type of Object.values(FileFormats))
                for (const [ext, mime] of Object.entries(type))
                    if (mime === mimeInput)
                        return ext;
        };
        FileUtils.extToMime = (ext) => {
            for (const type of Object.values(FileFormats))
                if (ext in type)
                    return type[ext];
        };
        FileUtils.toDataURL = (file) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.addEventListener("load", ({ target }) => {
                    resolve(target?.result);
                });
                reader.addEventListener("error", (err) => {
                    reject(err);
                });
                reader.readAsDataURL(file);
            });
        };
        FileUtils.fetchFile = async (url) => {
            try {
                const res = await fetch(url);
                if (!res.ok)
                    throw new Error("Error code: " + res.status);
                const blob = await res.blob();
                if (!ValidationUtils.fileIsAllowed(blob))
                    throw new Error("File type not allowd: " + blob);
                const pathname = new URL(url).pathname;
                const extension = FileUtils.mimeToExt(blob.type);
                const fallback = "file" + (extension ? "." + extension : "");
                const filename = pathname.split("/").pop() ?? fallback;
                return new File([blob], filename, { type: blob.type });
            }
            catch (err) {
                console.log(err);
            }
        };
        FileUtils.compressImage = async (file, limit = 2500) => {
            const validFormats = [
                FileFormats.Image.BMP,
                FileFormats.Image.JPG,
                FileFormats.Image.JPEG,
                FileFormats.Image.PNG,
            ];
            if (!ValidationUtils.fileIsValidImage(file, validFormats))
                return null;
            const toImageElement = async (file) => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    const url = URL.createObjectURL(file);
                    img.onload = () => {
                        URL.revokeObjectURL(url);
                        resolve(img);
                    };
                    img.onerror = reject;
                    img.src = url;
                });
            };
            const imageElement = await toImageElement(file);
            const canvas = document.createElement("canvas");
            canvas.width = imageElement.width;
            canvas.height = imageElement.height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(imageElement, 0, 0);
            const canvasToBlob = (canvas, quality) => {
                return new Promise((resolve) => {
                    canvas.toBlob((blob) => resolve(blob), FileFormats.Image.JPEG, quality);
                });
            };
            let quality = 0.95;
            let blob = await canvasToBlob(canvas, quality);
            while (blob && ValidationUtils.filesizeIsTooBig(blob, limit) && quality > 0.1) {
                quality -= 0.05;
                blob = await canvasToBlob(canvas, quality);
            }
            if (!blob)
                return null;
            const newFilename = file.name.replace(/\.[^/.]+$/, ".jpeg");
            const options = { type: blob.type, lastModified: file.lastModified };
            return new File([blob], newFilename, options);
        };
    })(FileUtils || (FileUtils = {}));
    var FileUtils$1 = FileUtils;

    const toolbar = new (class Toolbar {
        constructor() {
            this.class = "file-toolbar";
            this.buttons = {
                preview: { class: "preview-media", label: "P", title: "Preview media" },
                spoiler: { class: "spoiler-image", label: "S", title: "Spoiler image", name: "spoiler" },
                import: { class: "import-media", label: "U", title: "Import media from URL" },
                remove: { class: "remove-file", label: "×", title: "Remove file" },
            };
        }
        get html() {
            return this.template;
        }
        get template() {
            return StringUtils.templateHandler `
    <div class="${this.class}">
      <div class="btn-container button" title="${this.buttons.preview.title}">
        <a href="javascript:;" class="${this.buttons.preview.class}">${this.buttons.preview.label}</a>
      </div>
      <div class="btn-container toggle" title="${this.buttons.spoiler.title}">
        <label>${this.buttons.spoiler.label}<input type="checkbox" 
          class="${this.buttons.spoiler.class}" 
          name="${this.buttons.spoiler.name}"
        /></label>
      </div>
      <div class="btn-container button" title="${this.buttons.import.title}">
        <a href="javascript:;" class="${this.buttons.import.class}">${this.buttons.import.label}</a>
      </div>
      <div class="btn-container button" title="${this.buttons.remove.title}">
        <a href="javascript:;" class="${this.buttons.remove.class}">${this.buttons.remove.label}</a>
      </div>
    </div>
    `;
        }
    })();
    const handleChangeFileInput = ({ currentTarget }, form) => {
        const input = currentTarget;
        if (!input)
            return;
        if (!ValidationUtils.inputHasFile(input)) {
            form.classList.toggle("has-attachment", false);
            form.classList.toggle("has-media", false);
            form.classList.toggle("has-image", false);
            return;
        }
        form.classList.toggle("has-attachment", true);
        const file = input.files[0];
        if (!file)
            return;
        if (!ValidationUtils.fileIsValidImage(file) && !ValidationUtils.fileIsValidVideo(file))
            return;
        form.classList.toggle("has-media", true);
        if (ValidationUtils.fileIsValidImage(file))
            form.classList.toggle("has-image", true);
    };
    const handlePreviewMedia = (input) => {
        if (!ValidationUtils.inputHasFile(input))
            return;
        const file = input.files[0];
        if (!file)
            return;
        let media;
        const url = URL.createObjectURL(file);
        if (ValidationUtils.fileIsValidImage(file)) {
            media = new Image();
            media.addEventListener("load", () => URL.revokeObjectURL(url));
        }
        else if (ValidationUtils.fileIsValidVideo(file)) {
            media = document.createElement("video");
            media.controls = true;
            media.autoplay = true;
            media.muted = true;
            media.loop = true;
            media.addEventListener("canplay", () => URL.revokeObjectURL(url));
        }
        else {
            console.log("Unsupported MIME type:", file);
            return;
        }
        media.src = url;
        const modal = document.createElement("div");
        modal.id = "media-preview-modal";
        document.body.appendChild(modal);
        modal.appendChild(media);
        modal.addEventListener("click", ({ currentTarget, target }) => {
            if (target instanceof Element && target.closest("video"))
                return;
            currentTarget?.remove();
        });
    };
    const handleImportMedia = (input) => {
        const url = prompt("Enter a valid media URL:");
        if (!url)
            return;
        FileUtils$1.fetchFile(url).then((file) => {
            if (!file)
                return;
            if (!ValidationUtils.fileIsValidImage(file) && !ValidationUtils.fileIsValidVideo(file))
                return;
            FormUtils.setInputFile(input, file);
        });
    };
    const handleResetFileInput = (input) => {
        input.value = "";
        input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const fileToolbarFeature = (form) => {
        form.querySelector(`.${toolbar.class}`)?.remove();
        form.querySelector(`td:has(.${toolbar.buttons.spoiler.class})`)?.remove();
        const spoiler = form.querySelector(Selectors.Form.SPOILER);
        const fileInput = form.querySelector(Selectors.Form.INPUT_FILE);
        if (!spoiler || !fileInput)
            return;
        spoiler.parentElement?.insertAdjacentHTML("beforeend", toolbar.html);
        const previewBtn = form.querySelector(`.${toolbar.buttons.preview.class}`);
        previewBtn?.addEventListener("click", () => handlePreviewMedia(fileInput));
        const importURLBtn = form.querySelector(`.${toolbar.buttons.import.class}`);
        importURLBtn?.addEventListener("click", () => handleImportMedia(fileInput));
        const clearFileBtn = form.querySelector(`.${toolbar.buttons.remove.class}`);
        clearFileBtn?.addEventListener("click", () => handleResetFileInput(fileInput));
        fileInput.addEventListener("change", (e) => handleChangeFileInput(e, form));
    };

    const handleInputChange = async ({ target }) => {
        const input = target;
        if (!input || !ValidationUtils.inputHasFile(input))
            return;
        const file = input.files?.[0];
        if (!file || !ValidationUtils.filesizeIsTooBig(file))
            return;
        const compressedImage = await FileUtils$1.compressImage(file);
        if (ValidationUtils.fileIsValidImage(file, [FileFormats.Image.GIF])) {
            console.log("Filesize too big. Consider re-encoding to webm");
            return;
        }
        if (!compressedImage)
            return;
        FormUtils.setInputFile(input, compressedImage);
        console.log("Compressed image from", file, "to", compressedImage);
    };
    const imageCompressFeature = (form) => {
        const fileInput = form.querySelector(Selectors.Form.INPUT_FILE);
        if (!fileInput)
            return;
        fileInput.addEventListener("change", handleInputChange);
    };

    const handleCursorHover = (e) => {
        const time = e.currentTarget;
        if (!time)
            return;
        time.title = DateUtils.toRelative(new Date(time.dateTime));
    };
    const relativeTimeFeature = (post) => {
        const time = post.querySelectorAll("time");
        if (time.length < 1)
            return;
        time.forEach(el => el.addEventListener("mouseenter", handleCursorHover));
    };

    const handleButtonClick = (textarea) => {
        textarea.value = "";
    };
    const clearOnCloseFeature = (form) => {
        const cancelButton = form.querySelector(Selectors.Form.CLOSE_QR);
        const mainPostForm = document.querySelector(Selectors.Form.POST);
        if (!mainPostForm)
            return;
        const textarea = mainPostForm.querySelector(Selectors.Form.TEXTAREA);
        if (!cancelButton || !textarea)
            return;
        cancelButton.addEventListener("click", () => handleButtonClick(textarea));
    };

    const focusOnLoadFeature = (form) => {
        const textarea = form.querySelector(Selectors.Form.TEXTAREA);
        if (!textarea)
            return;
        textarea.focus();
    };

    const handleKeyUp = (event) => {
        if (event.key !== "q")
            return;
        const active = document.activeElement;
        if (active) {
            const isTypingField = active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.isContentEditable;
            if (isTypingField)
                return;
        }
        window.dispatchEvent(new CustomEvent('cite'));
    };
    const showonKeyupFeature = () => {
        document.addEventListener("keyup", handleKeyUp);
    };

    var Features;
    (function (Features) {
        (function (Form) {
            Form.pasteFileFromClipboard = filePasteFeature;
            Form.allowFileRenaming = fileRenameFeature;
            Form.addFileToolbar = fileToolbarFeature;
            Form.autoCompressBigImages = imageCompressFeature;
        })(Features.Form || (Features.Form = {}));
        (function (Post) {
            Post.relativeTimeOnHover = relativeTimeFeature;
        })(Features.Post || (Features.Post = {}));
        (function (QuickReply) {
            QuickReply.clearFormOnClose = clearOnCloseFeature;
            QuickReply.focusTextareaOnLoad = focusOnLoadFeature;
            QuickReply.showOnShortcutPressed = showonKeyupFeature;
        })(Features.QuickReply || (Features.QuickReply = {}));
    })(Features || (Features = {}));
    var Features$1 = Features;

    var e=[],t=[];function n(n,r){if(n&&"undefined"!=typeof document){var a,s=true===r.prepend?"prepend":"append",d=true===r.singleTag,i="string"==typeof r.container?document.querySelector(r.container):document.getElementsByTagName("head")[0];if(d){var u=e.indexOf(i);-1===u&&(u=e.push(i)-1,t[u]={}),a=t[u]&&t[u][s]?t[u][s]:t[u][s]=c();}else a=c();65279===n.charCodeAt(0)&&(n=n.substring(1)),a.styleSheet?a.styleSheet.cssText+=n:a.appendChild(document.createTextNode(n));}function c(){var e=document.createElement("style");if(e.setAttribute("type","text/css"),r.attributes)for(var t=Object.keys(r.attributes),n=0;n<t.length;n++)e.setAttribute(t[n],r.attributes[t[n]]);var a="prepend"===s?"afterbegin":"beforeend";return i.insertAdjacentElement(a,e),e}}

    var css = ".btn-container{--btn-size:14px;align-items:center;border:1px solid;border-radius:2px;box-sizing:border-box;display:inline-flex;flex-shrink:0;font-family:monospace;font-size:var(--btn-size,14px);height:var(--btn-size,14px);justify-content:center;line-height:var(--btn-size,14px);position:relative;width:var(--btn-size,14px)}.btn-container>:before{bottom:0;content:\"\";cursor:pointer;left:0;position:absolute;right:0;top:0}.btn-container.toggle input[type=checkbox]{margin:0;padding:0}.btn-container.toggle input[type=checkbox]:not(:checked){display:none}.btn-container.toggle:has(input:checked){border:0;font-size:0}.btn-container.toggle:has(input:checked) label{font-size:inherit}.btn-container label{align-items:center;display:flex;font-size:var(--btn-size,14px);justify-content:center}.btn-container a{color:inherit;text-decoration:none}form[name=post] input[name=file]{display:none}form[name=post] .upload-filename{box-sizing:border-box;float:left;margin-right:4px;padding-bottom:0;width:calc(79% - 4px)}form[name=post]#quick-reply .upload-filename{width:99%}form[name=post] td>input[name=spoiler],form[name=post] td>input[name=spoiler]~label{display:none}form[name=post]:not(.has-attachment) .btn-container:has(.remove-file){display:none}form[name=post]:not(.has-media) .btn-container:has(.preview-media){display:none}form[name=post]:not(.has-image) .btn-container:has(.spoiler-image){display:none}form[name=post]:not(#quick-reply) .file-toolbar{padding-top:2px}form[name=post] .file-toolbar{align-items:center;display:flex;gap:4px;justify-content:end}form[name=post] .remove-file{padding-bottom:2px}#quick-reply tr td:nth-child(2).spoiler{padding-right:2px}#media-preview-modal{align-items:center;background-color:rgba(0,0,0,.3);display:flex;height:100%;justify-content:center;left:0;position:fixed;top:0;width:100%;z-index:101}#media-preview-modal img,#media-preview-modal video{max-height:100%;max-width:100%}#quick-reply tr:last-of-type,#quick-reply>hr{display:none}";
    n(css,{"singleTag":true});

    const handleThreadFeatures = () => {
        const form = document.querySelector(Selectors.Index.INDEX);
        if (!form)
            return;
        const posts = form.querySelectorAll(Selectors.Index.POST + ":not(.hidden)");
        posts.forEach((post) => DOMUtils.onElementVisible(post, () => {
            Features$1.Post.relativeTimeOnHover(post);
        }));
    };
    const handleMainFormFeatures = () => {
        const form = document.querySelector(Selectors.Form.POST);
        if (!form)
            return;
        Features$1.Form.pasteFileFromClipboard(form);
        Features$1.Form.allowFileRenaming(form);
        Features$1.Form.addFileToolbar(form);
        Features$1.Form.autoCompressBigImages(form);
    };
    const handleQuickreplyFeatures = () => {
        const form = document.querySelector(Selectors.Form.POST_QR);
        if (!form)
            return;
        Features$1.QuickReply.clearFormOnClose(form);
        Features$1.QuickReply.focusTextareaOnLoad(form);
        Features$1.Form.pasteFileFromClipboard(form);
        Features$1.Form.allowFileRenaming(form);
        Features$1.Form.addFileToolbar(form);
        Features$1.Form.autoCompressBigImages(form);
    };
    const main = () => {
        DOMUtils.onElementLoaded(handleThreadFeatures, Selectors.Index.INDEX, true);
        DOMUtils.onElementLoaded(handleMainFormFeatures, Selectors.Form.POST, true);
        Features$1.QuickReply.showOnShortcutPressed();
        DOMUtils.onElementLoaded(handleQuickreplyFeatures, Selectors.Form.POST_QR);
    };
    try {
        DOMUtils.onContentLoaded(main, Selectors.Index.INDEX);
    }
    catch (err) {
        console.log("[tohno-chan-addons]", err);
    }

})();
//# sourceMappingURL=tohno-chan-tweaks.js.map
