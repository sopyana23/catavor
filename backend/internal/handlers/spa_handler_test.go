package handlers

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestResolveIndexHTML_Isolation(t *testing.T) {
	// 1. Mobile isolation test
	mobileResolved := resolveIndexHTML("public/mobile")
	if mobileResolved != "" {
		clean := filepath.ToSlash(mobileResolved)
		if !strings.HasSuffix(clean, "/mobile/index.html") && !strings.HasSuffix(clean, "mobile/index.html") {
			t.Errorf("Expected mobile index.html path, got: %s", mobileResolved)
		}
		if strings.Contains(clean, "/desktop/") {
			t.Errorf("CRITICAL BUG: resolveIndexHTML for mobile leaked into desktop: %s", mobileResolved)
		}
	}

	// 2. Tablet isolation test
	tabletResolved := resolveIndexHTML("public/tablet")
	if tabletResolved != "" {
		clean := filepath.ToSlash(tabletResolved)
		if !strings.HasSuffix(clean, "/tablet/index.html") && !strings.HasSuffix(clean, "tablet/index.html") {
			t.Errorf("Expected tablet index.html path, got: %s", tabletResolved)
		}
		if strings.Contains(clean, "/desktop/") {
			t.Errorf("CRITICAL BUG: resolveIndexHTML for tablet leaked into desktop: %s", tabletResolved)
		}
	}

	// 3. Desktop isolation test
	desktopResolved := resolveIndexHTML("public/desktop")
	if desktopResolved != "" {
		clean := filepath.ToSlash(desktopResolved)
		if !strings.HasSuffix(clean, "/desktop/index.html") && !strings.HasSuffix(clean, "desktop/index.html") {
			t.Errorf("Expected desktop index.html path, got: %s", desktopResolved)
		}
	}

	// 4. Empty path returns empty
	emptyResolved := resolveIndexHTML("")
	if emptyResolved != "" {
		t.Errorf("Expected empty string for empty input, got: %s", emptyResolved)
	}
}
