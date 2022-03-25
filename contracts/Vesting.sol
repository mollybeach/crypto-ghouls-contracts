// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract Vesting is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.UintSet;

    struct VestingSchedule {
        uint256 startTime;
        uint256 endTime;
        uint8 numberOfVestings;
        bool started;
        bool ended;
        EnumerableSet.AddressSet vestors;
    }
    struct VestingRewards {
        uint256 totalToEarn;
        uint256 earnedSoFar;
    }

    IERC20 public erc20Token;

    // vestingScheduleStartTime => VestingSchedule data
    mapping(uint256 => VestingSchedule) private _vestingSchedules;
    // Stores the IDs for each schedule the address is a part of
    mapping(address => EnumerableSet.UintSet) private _vestorsToSchedules;
    // address => vestingScheduleStartTime => lastClaimTime
    mapping(address => mapping(uint256 => uint256)) private _vestorLastClaimTime;
    // address => vestingScheduleStartTime => VestingRewards
    mapping(address => mapping(uint256 => VestingRewards)) private _vestorRewards;
    // List of every vesting schedule for 
    EnumerableSet.UintSet private _allVestingSchedules;

    constructor(address erc20Address) {
        erc20Token = IERC20(erc20Address);
    }

    // Used to get the IDs to be used for other contract functions
    // Use https://www.epochconverter.com to convert to time
    function getAllVestingSchedules() external view returns(uint256[] memory) {
        uint256[] memory schedules = new uint256[](_allVestingSchedules.length());
        for (uint256 i = 0; i < _allVestingSchedules.length(); i++) {
            schedules[i] = _allVestingSchedules.at(i);
        }
        return schedules;
    }

    function getSchedulesForVestor(address vestor) external view returns (uint256[] memory) {
        uint256[] memory schedules = new uint256[](_vestorsToSchedules[vestor].length());
        for (uint256 i = 0; i < _vestorsToSchedules[vestor].length(); i++) {
            schedules[i] = _vestorsToSchedules[vestor].at(i);
        }
        return schedules;
    }

    function isScheduleStarted(uint256 scheduleStartTime) external view returns(bool) {
        return _vestingSchedules[scheduleStartTime].started;
    }

    function isScheduleEnded(uint256 scheduleStartTime) external view returns(bool) {
        return _vestingSchedules[scheduleStartTime].ended;
    }

    function createNewVestingSchedule(uint256 startTime, uint256 endTime, uint8 numOfVestings) external onlyOwner {
        require(endTime > startTime, "endTime must be after startTime");
        require(numOfVestings > 0, "Invalid number of vestings");
        require(_vestingSchedules[startTime].startTime == 0, "Vesting schedule already exists");
        VestingSchedule storage v = _vestingSchedules[startTime];
                v.startTime = startTime;
                v.endTime = endTime;
                v.numberOfVestings = numOfVestings;
                v.started = false;
                v.ended = false;
        _allVestingSchedules.add(startTime);
    }

    function startVestingSchedule(uint256 vestingScheduleStartTime) external onlyOwner {
        _vestingSchedules[vestingScheduleStartTime].started = true;
    }

    function endVestingSchedule(uint256 vestingScheduleStartTime) external onlyOwner {
        // Disallow ending the schedule if it hasn't passed the end time,
        //  or if all of the rewards have not been claimed
        require(block.timestamp >= _vestingSchedules[vestingScheduleStartTime].endTime
            , "Vesting has not ended");
        for (uint256 i = 0; i < _vestingSchedules[vestingScheduleStartTime].vestors.length(); i++) {
            address vestor = _vestingSchedules[vestingScheduleStartTime].vestors.at(i);
            require(_vestorRewards[vestor][vestingScheduleStartTime].earnedSoFar 
                != _vestorRewards[vestor][vestingScheduleStartTime].totalToEarn
                , "Not all rewards claimed");
        }
        _vestingSchedules[vestingScheduleStartTime].ended = true;
    }

    function addToVestings(uint256 vestingStartTime, address vestor, uint256 totalAmtToEarn) external onlyOwner {
        require(_vestingSchedules[vestingStartTime].startTime > 0
            , "Invalid vesting schedule");
        // Only allow vestors to be added to schedules that are not started.
        require(!_vestingSchedules[vestingStartTime].started
            , "Vesting schedule already started");
        _vestingSchedules[vestingStartTime].vestors.add(vestor);
        // Initialize the vestor's rewards for the given schedule
        _vestorRewards[vestor][vestingStartTime] = VestingRewards(totalAmtToEarn, 0);
        _vestorsToSchedules[vestor].add(vestingStartTime);
    }

    function claimVestingRewards() external {
        require(_vestorsToSchedules[_msgSender()].length() > 0, "Sender not in any schedules");
        uint256 rewardsToClaim;
        for (uint256 i = 0; i < _vestorsToSchedules[_msgSender()].length(); i++) {
            uint256 curSchedule = _vestorsToSchedules[_msgSender()].at(i);
            // Check if current vesting schedule has rewards to claim
            uint256 reward = getRewardsForVestingSchedule(_msgSender(), curSchedule);
            if(reward > 0) {
                rewardsToClaim += reward;
                _vestorLastClaimTime[_msgSender()][curSchedule] = getLastClaimedVestingTime(curSchedule);
                _vestorRewards[_msgSender()][curSchedule].earnedSoFar += reward;
            }
        }
        if(rewardsToClaim == 0) {
            // Dont allow someone to spend gas for 0 rewards
            revert("No rewards to claim");
        }
        erc20Token.transfer(_msgSender(), rewardsToClaim);
    }

    function getLastClaimedVestingTime(uint256 vestingSchedule) private view returns (uint256 lastVestTime) {
        VestingSchedule storage vs = _vestingSchedules[vestingSchedule];
        uint256 vestingDuration = vs.endTime - vs.startTime;
        uint256 timePerVest = vestingDuration / vs.numberOfVestings;
        for (uint256 i = 1; i <= vs.numberOfVestings; i++) {
            if(!vs.started || vs.ended) {
                break;
            }
            uint256 nextVestingTime = vs.startTime + (timePerVest * i);
            if(block.timestamp > nextVestingTime) {
                lastVestTime = nextVestingTime;
            }
        }
    }

    function getRewardsForVestingSchedule(address vestor, uint256 vestingSchedule) public view returns (uint256 rewardsToClaim) {
        require(_vestorsToSchedules[vestor].contains(vestingSchedule), "Vestor not in schedule");
        require(_vestingSchedules[vestingSchedule].startTime > 0, "Invalid vesting schedule");
        VestingSchedule storage vs = _vestingSchedules[vestingSchedule];
        uint256 vestingDuration = vs.endTime - vs.startTime;
        uint256 timePerVest = vestingDuration / vs.numberOfVestings;
        for (uint256 i = 1; i <= vs.numberOfVestings; i++) {
            if(!vs.started || vs.ended) {
                break;
            }
            uint256 nextVestingTime = vs.startTime + (timePerVest * i);
            if(block.timestamp > nextVestingTime
                && nextVestingTime > _vestorLastClaimTime[vestor][vestingSchedule])
            {
                rewardsToClaim += _vestorRewards[vestor][vestingSchedule].totalToEarn / vs.numberOfVestings;
            }
        }
    }
    
}