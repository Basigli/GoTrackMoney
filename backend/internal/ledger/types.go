package ledger

import "time"

type createUserParams struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type createCategoryParams struct {
	Name string `json:"name"`
}

type createExpenseParams struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Amount      float64    `json:"amount"`
	CategoryID  int64      `json:"category_id"`
	SpentOn     *time.Time `json:"spent_on,omitempty"`
}

type createIncomeParams struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Amount      float64    `json:"amount"`
	CategoryID  int64      `json:"category_id"`
	ReceivedOn  *time.Time `json:"received_on,omitempty"`
}

type loginParams struct {
	Username string `json:"username"`
	Password string `json:"password"`
}
