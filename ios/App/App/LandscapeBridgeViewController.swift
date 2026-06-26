import UIKit
import Capacitor

class LandscapeBridgeViewController: CAPBridgeViewController {
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        if UIDevice.current.userInterfaceIdiom == .phone {
            return [.landscapeLeft, .landscapeRight]
        }
        return super.supportedInterfaceOrientations
    }

    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        if UIDevice.current.userInterfaceIdiom == .phone {
            return .landscapeRight
        }
        return super.preferredInterfaceOrientationForPresentation
    }

    override var shouldAutorotate: Bool {
        UIDevice.current.userInterfaceIdiom != .phone
    }
}
