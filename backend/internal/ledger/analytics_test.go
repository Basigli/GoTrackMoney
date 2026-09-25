package ledger

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAnalyticsRejectsInvalidMonths(t *testing.T) {
	h := &handler{}
	for _, query := range []string{
		"year=2026&month=0", "year=2026&month=13", "year=2026&month=-1",
		"year=0&month=1", "year=10000&month=1", "year=no&month=1",
		"year=2026", "month=1",
	} {
		t.Run(query, func(t *testing.T) {
			response := httptest.NewRecorder()
			h.AnalyticsIncomeVsExpense(response, httptest.NewRequest(http.MethodGet, "/?"+query, nil))
			if response.Code != http.StatusBadRequest {
				t.Fatalf("got %d", response.Code)
			}
		})
	}
}

func TestDateFilterBoundaries(t *testing.T) {
	for _, test := range []struct{ query, start, end string }{
		{"year=2024&month=2", "2024-02-01", "2024-03-01"},
		{"year=2025&month=12", "2025-12-01", "2026-01-01"},
		{"year=2026&month=0", "2026-01-01", "2027-01-01"},
	} {
		t.Run(test.query, func(t *testing.T) {
			start, end, err := parseDateFilter(httptest.NewRequest(http.MethodGet, "/?"+test.query, nil))
			if err != nil {
				t.Fatal(err)
			}
			if start.Format(time.DateOnly) != test.start || end.Format(time.DateOnly) != test.end {
				t.Fatalf("unexpected range: %v - %v", start, end)
			}
		})
	}
	for _, query := range []string{"year=2026&month=13", "year=2026&month=-1", "year=0", "year=10000"} {
		if _, _, err := parseDateFilter(httptest.NewRequest(http.MethodGet, "/?"+query, nil)); err == nil {
			t.Errorf("accepted invalid query %s", query)
		}
	}
}
