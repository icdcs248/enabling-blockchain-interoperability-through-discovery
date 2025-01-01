package substrate

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

const (
	ROOT_SPEC_URL = "http://localhost:3000/json/rootSpec.json"
)

type ChainSpecRes struct {
	Id        string   `json:"id"`
	BootNodes []string `json:"bootNodes"`
}

func FetchChainSpecJSON(chainSpecUrl string) (*ChainSpecRes, error) {
	res, err := http.Get(strings.Replace(chainSpecUrl, "json_server", "localhost", 1))
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	var chainSpec ChainSpecRes

	err = json.Unmarshal(body, &chainSpec)
	if err != nil {
		return nil, err
	}

	return &chainSpec, nil
}
