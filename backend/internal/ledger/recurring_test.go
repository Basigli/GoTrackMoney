package ledger

import (
	"net/http/httptest"
	"testing"
	"time"
)

func TestNextOccurrence(t *testing.T) {
	for _, tc := range []struct {
		due, anchor, want, unit string
		interval                int32
	}{
		{"2024-01-31", "2024-01-31", "2024-02-29", "months", 1},
		{"2024-02-29", "2024-01-31", "2024-03-31", "months", 1},
		{"2024-12-31", "2024-12-31", "2025-01-31", "months", 1},
		{"2024-02-29", "2024-02-29", "2025-02-28", "years", 1},
		{"2027-02-28", "2024-02-29", "2028-02-29", "years", 1},
		{"2026-01-31", "2026-01-31", "2026-03-31", "months", 2},
		{"2026-09-25", "2026-09-25", "2026-10-09", "weeks", 2},
	} {
		t.Run(tc.due+tc.unit+tc.want, func(t *testing.T) {
			due, _ := time.Parse(time.DateOnly, tc.due)
			anchor, _ := time.Parse(time.DateOnly, tc.anchor)
			got, err := nextOccurrence(due, anchor, tc.interval, tc.unit)
			if err != nil || got.Format(time.DateOnly) != tc.want {
				t.Fatalf("got %v, %v", got, err)
			}
		})
	}
	if _, err := nextOccurrence(time.Now(), time.Now(), 0, "months"); err == nil {
		t.Fatal("accepted zero interval")
	}
	if _, err := nextOccurrence(time.Now(), time.Now(), 1, "invalid"); err == nil {
		t.Fatal("accepted invalid unit")
	}
}
func TestSearchValidation(t *testing.T) {
	for _, query := range []string{"limit=0", "limit=101", "offset=-1", "type=other", "category_id=-1", "from=2026-02-30", "from=2026-03-01&to=2026-02-28", "min_amount=NaN", "max_amount=Inf", "min_amount=3&max_amount=2"} {
		if _, err := parseSearch(httptest.NewRequest("GET", "/?"+query, nil)); err == nil {
			t.Errorf("accepted %s", query)
		}
	}
	p, err := parseSearch(httptest.NewRequest("GET", "/?q=12%2C50&from=2024-02-01&to=2024-02-29", nil))
	if err != nil || p.ExactAmount != 12.5 || p.DateTo.Time.Format(time.DateOnly) != "2024-03-01" || p.PageLimit != 50 {
		t.Fatalf("unexpected filters: %+v %v", p, err)
	}
}
