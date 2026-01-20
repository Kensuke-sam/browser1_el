pub struct ExamMode {
    enabled: bool,
}

impl ExamMode {
    pub fn new() -> Self {
        Self { enabled: false }
    }

    pub fn toggle(&mut self) -> bool {
        self.enabled = !self.enabled;
        self.enabled
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }

    pub fn get_injection_css() -> &'static str {
        r#"
        (() => {
            const existingStyle = document.getElementById('yellow-mode');
            if (existingStyle) {
                existingStyle.remove();
            } else {
                const style = document.createElement('style');
                style.id = 'yellow-mode';
                style.textContent = `
                    * {
                        background: #fffbd5 !important;
                    }
                    *:not(img):not(video):not(canvas) {
                        background: white !important;
                        color: #333 !important;
                    }
                `;
                document.head.appendChild(style);
            }
        })()
        "#
    }
}

impl Default for ExamMode {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_toggle() {
        let mut exam_mode = ExamMode::new();
        assert!(!exam_mode.is_enabled());

        exam_mode.toggle();
        assert!(exam_mode.is_enabled());

        exam_mode.toggle();
        assert!(!exam_mode.is_enabled());
    }

    #[test]
    fn test_injection_css() {
        let css = ExamMode::get_injection_css();
        assert!(css.contains("yellow-mode"));
        assert!(css.contains("#fffbd5"));
    }
}
