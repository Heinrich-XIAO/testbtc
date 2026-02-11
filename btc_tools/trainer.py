"""Training helpers for BTC up/down classification."""
from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset


class BtcClassifier(nn.Module):
    def __init__(self, features: int, window: int, channels: int = 32, gru_hidden: int = 64, dropout: float = 0.2):
        super().__init__()
        self.conv = nn.Conv1d(features, channels, kernel_size=3, padding=1)
        self.gru = nn.GRU(channels, gru_hidden, batch_first=True)
        self.dropout = nn.Dropout(dropout)
        self.head = nn.Linear(gru_hidden, 2)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x.transpose(1, 2)
        x = torch.relu(self.conv(x))
        x = x.transpose(1, 2)
        x, _ = self.gru(x)
        x = x[:, -1, :]
        return self.head(self.dropout(x))


def build_features(data: pd.DataFrame) -> pd.DataFrame:
    data = data.copy()
    data["return_1s"] = np.log(data["price_close"] / data["price_close"].shift(1))
    data["body"] = data["price_close"] - data["price_open"]
    data["range"] = data["price_high"] - data["price_low"]
    data["volume_delta"] = data["volume_traded"].pct_change()
    data["sma_short"] = data["price_close"].rolling(16, min_periods=1).mean()
    data["sma_long"] = data["price_close"].rolling(64, min_periods=1).mean()
    data["spread"] = data["price_close"] - data["sma_long"]
    data["target"] = (data["price_close"].shift(-1) > data["price_close"]).astype(int)
    return data.dropna().reset_index(drop=True)


def make_sequences(features: np.ndarray, target: np.ndarray, window: int) -> tuple[np.ndarray, np.ndarray]:
    total = len(features) - window
    X = np.stack([features[i : i + window] for i in range(total)])
    return X, target[window:]


def standardize(np_data: np.ndarray, mean: np.ndarray, std: np.ndarray) -> np.ndarray:
    return (np_data - mean) / (std + 1e-6)


def evaluate(model: nn.Module, loader: DataLoader, criterion: nn.Module, device: torch.device) -> tuple[float, float]:
    model.eval()
    total_loss = 0.0
    correct = 0
    samples = 0
    with torch.no_grad():
        for X, y in loader:
            X = X.to(device)
            y = y.to(device)
            logits = model(X)
            total_loss += criterion(logits, y).item() * X.size(0)
            preds = logits.argmax(dim=1)
            correct += (preds == y).sum().item()
            samples += X.size(0)
    return total_loss / samples, correct / samples


def train_model(
    data_path: Path,
    window: int,
    batch_size: int,
    epochs: int,
    lr: float,
    output: Path,
) -> dict[str, float]:
    if not data_path.exists():
        raise FileNotFoundError("data file does not exist")

    df = pd.read_csv(
        data_path,
        parse_dates=["time_period_start"],
        usecols=["time_period_start", "price_open", "price_high", "price_low", "price_close", "volume_traded"],
    )
    df = build_features(df)
    feature_cols = ["return_1s", "body", "range", "volume_delta", "sma_short", "sma_long", "spread"]
    features = df[feature_cols].to_numpy()
    target = df["target"].to_numpy()

    X, y = make_sequences(features, target, window)
    split = int(len(X) * 0.8)
    mean = X[:split].mean(axis=(0, 1))
    std = X[:split].std(axis=(0, 1))
    X = standardize(X, mean, std)

    X_train, X_valid = X[:split], X[split:]
    y_train, y_valid = y[:split], y[split:]

    train_loader = build_loader(X_train, y_train, batch_size, shuffle=True)
    valid_loader = build_loader(X_valid, y_valid, batch_size, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = BtcClassifier(len(feature_cols), window)
    model.to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr)
    criterion = nn.CrossEntropyLoss()

    history: dict[str, list[float]] = {"train_loss": [], "train_acc": [], "valid_loss": [], "valid_acc": []}
    best_loss = math.inf

    for epoch in range(1, epochs + 1):
        model.train()
        epoch_loss = 0.0
        epoch_correct = 0
        epoch_samples = 0
        for X_batch, y_batch in train_loader:
            X_batch = X_batch.to(device)
            y_batch = y_batch.to(device)
            optimizer.zero_grad()
            logits = model(X_batch)
            loss = criterion(logits, y_batch)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            epoch_loss += loss.item() * X_batch.size(0)
            epoch_correct += (logits.argmax(dim=1) == y_batch).sum().item()
            epoch_samples += X_batch.size(0)
        train_loss = epoch_loss / epoch_samples
        train_acc = epoch_correct / epoch_samples
        valid_loss, valid_acc = evaluate(model, valid_loader, criterion, device)
        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["valid_loss"].append(valid_loss)
        history["valid_acc"].append(valid_acc)
        print(
            f"Epoch {epoch:02d} | train loss {train_loss:.4f} acc {train_acc:.4f} | valid loss {valid_loss:.4f} acc {valid_acc:.4f}",
            file=sys.stderr,
        )
        if valid_loss < best_loss:
            best_loss = valid_loss
            output.parent.mkdir(parents=True, exist_ok=True)
            torch.save(model.state_dict(), output.with_name(f"{output.stem}.best.pt"))

    final_loss, final_acc = evaluate(model, valid_loader, criterion, device)
    model.eval()
    torch.save(
        {
            "model": model.state_dict(),
            "mean": mean.tolist(),
            "std": std.tolist(),
            "features": feature_cols,
            "window": window,
        },
        output,
    )
    with open(output.with_suffix(".meta.json"), "w", encoding="utf-8") as meta:
        json.dump(
            {
                "final_val_loss": final_loss,
                "final_val_acc": final_acc,
                "history": history,
                "class_map": ["down", "up"],
            },
            meta,
            indent=2,
        )
    return {"final_val_loss": final_loss, "final_val_acc": final_acc}


def build_loader(X: np.ndarray, y: np.ndarray, batch_size: int, shuffle: bool) -> DataLoader:
    tensor_X = torch.from_numpy(X).float()
    tensor_y = torch.from_numpy(y).long()
    return DataLoader(TensorDataset(tensor_X, tensor_y), batch_size=batch_size, shuffle=shuffle)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train BTC up/down classifier on per-second data.")
    parser.add_argument("--data", required=True, help="Path to BTC CSV from data collector")
    parser.add_argument("--window", type=int, default=64, help="Number of seconds in each sample")
    parser.add_argument("--batch", type=int, default=512, help="Training batch size")
    parser.add_argument("--epochs", type=int, default=5, help="Epochs to train")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--output", default="models/btc_classifier.pt", help="Directory to emit artifacts")
    return parser


def train_main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        train_model(
            data_path=Path(args.data),
            window=args.window,
            batch_size=args.batch,
            epochs=args.epochs,
            lr=args.lr,
            output=output_path,
        )
    except FileNotFoundError as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    train_main()
